# People's profiles (/people/:username, app/services/profile_page.rb) and following them.
# Only for signed-in people who can use Groups (User.profiles_open_to?); "me" is you.
class Api::PeopleController < ApplicationController
  include GroupScoped

  before_action :require_profiles
  before_action :set_person, except: :index

  # GET /api/people[?q=name] -> people matching q (or nobody), and what the people you
  # follow have shared lately
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

  # POST /api/people/:username/follow
  def follow
    return render(json: { error: "You can't follow yourself." }, status: :unprocessable_entity) if @person == current_user

    follow = current_user.follows_given.find_or_create_by!(followed: @person)
    if follow.previously_new_record?
      Notification.deliver(@person, kind: "follow.created", title: "#{current_user.display_name} followed you",
                                    body: "They'll see what you share with followers.", url: current_user.profile_path)
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
