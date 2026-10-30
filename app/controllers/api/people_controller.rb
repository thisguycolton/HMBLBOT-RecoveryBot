# People's profiles (/people/:username, app/services/profile_page.rb) and following them.
# Only for signed-in people who can use Groups (User.profiles_open_to?); "me" is you.
class Api::PeopleController < ApplicationController
  include GroupScoped

  FOLLOW_LIST_MAX = 1000

  before_action :require_profiles
  before_action :set_person, except: :index

  # GET /api/people[?q=name][&before=ISO8601] -> the home page: people matching q, or your
  # notes and highlights and those of the people you follow, and what's coming up in your groups
  def index
    q = params[:q].to_s.strip
    matches = if q.length >= 2
                like = "%#{User.sanitize_sql_like(q)}%"
                User.where("name ILIKE :q OR username ILIKE :q", q: like).where.not(id: current_user.id)
                    .includes(avatar_attachment: :blob).order(:name).limit(20).map(&:as_person_json)
              end
    render json: {
      me: current_user.as_person_json,
      matches: matches,
      following_count: current_user.follows_given.count,
      feed: (ProfilePage.new(current_user).following_feed(before: before_param) unless q.present?),
      coming_up: (PeopleHome.new(current_user).json if q.blank? && before_param.nil?),
      note_max: TimelineNote::BODY_MAX, images_max: TimelineNote::IMAGES_MAX,
      default_note_visibility: current_user.default_note_visibility,
      groups: current_user.groups.order(:title).map { |g| { slug: g.slug, title: g.title } },
    }
  end

  # GET /api/people/:username
  def show
    render json: ProfilePage.new(current_user).person_json(@person)
  end

  # GET /api/people/:username/feed?before=ISO8601 -> older notes and highlights
  def feed
    render json: { feed: ProfilePage.new(current_user).feed(@person, before: before_param) }
  end

  # GET /api/people/:username/followers and /following -> everyone on that list, newest first
  # (the profile's follower counts open these)
  def followers
    render json: { people: ProfilePage.new(current_user).people(@person.followers, limit: FOLLOW_LIST_MAX) }
  end

  def following
    render json: { people: ProfilePage.new(current_user).people(@person.following, limit: FOLLOW_LIST_MAX) }
  end

  # POST /api/people/:username/follow
  def follow
    return render(json: { error: "You can't follow yourself." }, status: :unprocessable_entity) if @person == current_user

    follow = current_user.follows_given.find_or_create_by!(followed: @person)
    if follow.previously_new_record?
      Notification.deliver(@person, kind: "follow.created", title: "#{current_user.display_name} followed you",
                                    body: "They'll see what you share with followers.", url: current_user.profile_path, from: current_user)
    end
    render json: follow_json
  rescue ActiveRecord::RecordNotUnique
    render json: follow_json
  end

  # DELETE /api/people/:username/follow
  def unfollow
    current_user.follows_given.where(followed: @person).destroy_all
    render json: follow_json
  end

  # POST /api/people/:username/block -> their notes, comments and chat messages are hidden
  # from you and you aren't told what they do (UserBlock). They aren't told.
  def block
    return render(json: { error: "You can't block yourself." }, status: :unprocessable_entity) if @person == current_user

    current_user.blocks_given.find_or_create_by!(blocked: @person)
    render json: { blocked: true }
  rescue ActiveRecord::RecordNotUnique
    render json: { blocked: true }
  end

  # DELETE /api/people/:username/block
  def unblock
    current_user.blocks_given.where(blocked: @person).delete_all
    render json: { blocked: false }
  end

  private

  def require_profiles
    return if User.profiles_open_to?(current_user)

    render json: { error: "Profiles aren't open yet." }, status: :forbidden
  end

  def set_person
    @person = params[:username] == "me" ? current_user : User.find_by!(username: params[:username].to_s.downcase)
  rescue ActiveRecord::RecordNotFound
    render json: { error: "There's nobody here by that name." }, status: :not_found
  end

  def follow_json
    { following: current_user.following?(@person), followers_count: @person.follows_received.count }
  end

  def before_param
    Time.iso8601(params[:before]) if params[:before].present?
  rescue ArgumentError
    nil
  end
end
