# People's profiles (/people/:username, app/services/profile_page.rb) and following them.
# Only for signed-in people who can use Groups (User.profiles_open_to?); "me" is you.
class Api::PeopleController < ApplicationController
  include GroupScoped

  FOLLOW_LIST_MAX = 1000

  before_action :require_profiles
  before_action :set_person, except: :index

  # GET /api/people[?q=name] -> the home page: people matching q, or the first page of your
  # notes and highlights and those of the people you follow (feed, and feed_next: the cursor
  # for the next page), and what's coming up in your groups.
  # GET /api/people?cursor=... -> { feed, feed_next }: the next page only ("Load more")
  def index
    if cursor_param
      page = home_feed
      return render(json: { feed: page[:items], feed_next: page[:next] })
    end

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
      **home_feed_json(q),
      # Site admins only: whether the feed is everyone's posts (the sidebar's switch)
      everyone: (current_user.sees_all_posts? if current_user.suite_admin?),
      coming_up: (PeopleHome.new(current_user).json if q.blank?),
      note_max: TimelineNote::BODY_MAX, images_max: TimelineNote::IMAGES_MAX,
      default_note_visibility: current_user.default_note_visibility,
      groups: current_user.groups.order(:title).map { |g| { slug: g.slug, title: g.title } },
    }
  end

  # Your notes and those of the people you follow, or for a site admin with "Everyone's
  # posts" on, every member's shared notes (ProfilePage#everyone_feed)
  def home_feed
    page = ProfilePage.new(current_user)
    current_user.sees_all_posts? ? page.everyone_feed(cursor: cursor_param) : page.following_feed(cursor: cursor_param)
  end

  def home_feed_json(q)
    return { feed: nil, feed_next: nil } if q.present?

    page = home_feed
    { feed: page[:items], feed_next: page[:next] }
  end
  private :home_feed, :home_feed_json

  # GET /api/people/:username
  def show
    render json: ProfilePage.new(current_user).person_json(@person)
  end

  # GET /api/people/:username/feed?cursor=... -> { feed, next }: the next page of their notes
  # and highlights (FeedPage), after the one ending at `cursor`
  def feed
    page = ProfilePage.new(current_user).feed(@person, cursor: cursor_param)
    render json: { feed: page[:items], next: page[:next] }
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

  # A FeedPage cursor; `before` (an ISO 8601 time) is what older pages of the app sent
  def cursor_param
    (params[:cursor].presence || params[:before].presence)&.to_s
  end
end
