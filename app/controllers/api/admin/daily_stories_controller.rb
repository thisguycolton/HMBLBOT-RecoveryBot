# Site Admin > Daily story: the Facebook Page the day's Daily Reflection goes to as a Story
# (FacebookPageConnection), when it posts, "Post now", and how the last posts went (DailyStory).
class Api::Admin::DailyStoriesController < Api::Admin::SuiteController
  NETWORK_ERRORS = [MetaGraph::Error, SocketError, SystemCallError, Net::OpenTimeout, Net::ReadTimeout, OpenSSL::SSL::SSLError].freeze

  rescue_from(*NETWORK_ERRORS) { |e| render json: { error: e.message }, status: :unprocessable_entity }

  # GET /api/admin/daily_story
  def show
    render json: payload
  end

  # PATCH /api/admin/daily_story { enabled, instagram_enabled, post_at, time_zone, look }
  def update
    attrs = params.permit(:enabled, :instagram_enabled, :post_at, :time_zone, :look)
    if attrs.key?(:post_at) || attrs.key?(:time_zone)
      # a new time today shouldn't be skipped because today was claimed under the old one
      today = Time.current.in_time_zone(connection.zone).to_date
      attrs[:posted_on] = nil unless DailyStoryPost.where(on: today, status: %w[posted partial]).exists?
    end
    connection.update(attrs) ? render(json: payload) : render_errors(connection)
  end

  # POST /api/admin/daily_story/token { token }: a Page token pasted in (a system user's, say)
  def token
    page = MetaGraph.page_for_token(params[:token].to_s.strip)
    connection.connect!(page, user: current_user)
    render json: payload
  end

  # POST /api/admin/daily_story/choose { page_id }: which of the signed-in account's Pages
  def choose
    page = connection.choices.find { |c| c["id"].to_s == params[:page_id].to_s }
    return render(json: { error: "That Page isn't one to pick from." }, status: :unprocessable_entity) unless page

    connection.connect!(page, user: current_user)
    render json: payload
  end

  # POST /api/admin/daily_story/post_now
  def post_now
    return render(json: { error: "Connect a Facebook Page first." }, status: :unprocessable_entity) unless connection.connected?
    return render(json: { error: "A story is posting already." }, status: :conflict) unless DailyStory.post_soon(connection, user: current_user)

    render json: payload
  end

  # DELETE /api/admin/daily_story: forget the Page and its token
  def destroy
    connection.disconnect!
    render json: payload
  end

  private

  def connection = @connection ||= FacebookPageConnection.current

  def payload
    today = Time.current.in_time_zone(connection.zone).to_date
    chapter = DailyStory.chapter_for(today)
    {
      connection: connection.reload.as_admin_json,
      posts: DailyStoryPost.recent.includes(:user).limit(30).map(&:as_admin_json),
      today: chapter && { title: chapter.title, on: today.iso8601,
                          preview_url: "/api/books/#{DailyStory::BOOK}/chapters/#{chapter.slug}/card?#{{ video: 1, size: 'story', look: connection.look }.to_query}" },
      callback_url: admin_panel_facebook_callback_url,
      looks: QuoteCard::LOOKS,
    }
  end
end
