require "net/http"

# Meta's Graph API, for the daily Story (DailyStory): signing in to pick a Page, then posting
# a video Story to the Page (Page Stories API) and to its Instagram business account
# (Instagram content publishing). Needs FACEBOOK_APP_ID and FACEBOOK_APP_SECRET (a Meta app
# the site admin made at developers.facebook.com); FACEBOOK_LOGIN_CONFIG_ID when the app uses
# Facebook Login for Business configurations instead of plain permissions.
#
# Only the day's reading goes to Meta, never anything about members.
module MetaGraph
  VERSION = "v26.0"
  GRAPH = "https://graph.facebook.com"
  DIALOG = "https://www.facebook.com"
  IG_UPLOAD = "https://rupload.facebook.com/ig-api-upload"
  PAGE_SCOPES = %w[pages_show_list pages_read_engagement pages_manage_posts].freeze
  INSTAGRAM_SCOPES = %w[instagram_basic instagram_content_publish business_management].freeze
  PAGE_FIELDS = "id,name,access_token,tasks,instagram_business_account{id,username}"
  IG_WAIT = 10        # seconds between checks while Instagram processes a video
  IG_WAIT_MAX = 5 * 60

  class Error < StandardError
    attr_reader :code

    def initialize(message, code: nil)
      super(message)
      @code = code
    end

    # Facebook's "this token doesn't work any more" (signed out, password changed, app removed)
    def expired_token? = code.to_i == 190
  end

  module_function

  def app_id = ENV["FACEBOOK_APP_ID"].presence
  def app_secret = ENV["FACEBOOK_APP_SECRET"].presence
  def config_id = ENV["FACEBOOK_LOGIN_CONFIG_ID"].presence
  def configured? = app_id.present? && app_secret.present?

  # Where the "Connect Facebook Page" button sends them
  def dialog_url(redirect_uri:, state:, instagram: false)
    q = { client_id: app_id, redirect_uri: redirect_uri, state: state, response_type: "code" }
    if config_id
      q[:config_id] = config_id
    else
      q[:scope] = (PAGE_SCOPES + (instagram ? INSTAGRAM_SCOPES : [])).join(",")
    end
    "#{DIALOG}/#{VERSION}/dialog/oauth?#{q.to_query}"
  end

  # The sign-in's code -> a long-lived (60 day) user token, from which Page tokens don't expire
  def user_token(code:, redirect_uri:)
    short = get("/oauth/access_token", client_id: app_id, client_secret: app_secret, redirect_uri: redirect_uri, code: code)["access_token"]
    get("/oauth/access_token", grant_type: "fb_exchange_token", client_id: app_id, client_secret: app_secret, fb_exchange_token: short)["access_token"]
  end

  # The Pages they manage that they can post to, each with its own token and linked Instagram
  def pages(user_token)
    Array(get("/me/accounts", fields: PAGE_FIELDS, limit: 100, access_token: user_token)["data"])
      .select { |p| p["tasks"].nil? || (Array(p["tasks"]) & %w[CREATE_CONTENT MANAGE]).any? }
  end

  # A pasted Page token -> the Page it's for, shaped like #pages'. Facebook says what kind of
  # token it is when the app is set up; a person's token is turned away.
  def page_for_token(token)
    if configured?
      info = get("/debug_token", input_token: token, access_token: "#{app_id}|#{app_secret}")["data"] || {}
      raise Error, "Facebook says that token doesn't work." if info["is_valid"] == false
      raise Error, "That's a token for a person, not a Page. Use the Page's own token." if info["type"] && info["type"] != "PAGE"
    end
    get("/me", fields: "id,name,instagram_business_account{id,username}", access_token: token).merge("access_token" => token)
  end

  # Posts an MP4 as a Story on the Page; returns its post id
  def post_page_story(page_id, token, path)
    start = post("/#{page_id}/video_stories", upload_phase: "start", access_token: token)
    upload(start["upload_url"], token, path)
    finish = post("/#{page_id}/video_stories", upload_phase: "finish", video_id: start["video_id"], access_token: token)
    raise Error, "Facebook didn't post the story." unless finish["success"] || finish["post_id"]

    finish["post_id"] || start["video_id"]
  end

  # Posts an MP4 as an Instagram Story; returns its media id. Instagram processes the video
  # first, which takes a minute or two.
  def post_instagram_story(ig_id, token, path, wait: IG_WAIT)
    container = post("/#{ig_id}/media", media_type: "STORIES", upload_type: "resumable", access_token: token)
    upload(container["uri"].presence || "#{IG_UPLOAD}/#{VERSION}/#{container['id']}", token, path)
    waited = 0
    loop do
      status = get("/#{container['id']}", fields: "status_code,status", access_token: token)
      break if status["status_code"] == "FINISHED"
      raise Error, "Instagram couldn't use the video: #{status['status'] || status['status_code']}" if %w[ERROR EXPIRED].include?(status["status_code"])
      raise Error, "Instagram took too long with the video." if waited >= IG_WAIT_MAX

      sleep wait
      waited += [wait, 1].max
    end
    post("/#{ig_id}/media_publish", creation_id: container["id"], access_token: token)["id"]
  end

  def get(path, params)
    uri = URI("#{GRAPH}/#{VERSION}#{path}")
    uri.query = params.to_query
    request(uri, Net::HTTP::Get.new(uri))
  end

  def post(path, params)
    uri = URI("#{GRAPH}/#{VERSION}#{path}")
    req = Net::HTTP::Post.new(uri)
    req.set_form_data(params.transform_values(&:to_s))
    request(uri, req)
  end

  # The file's bytes to an upload address Facebook gave (rupload.facebook.com)
  def upload(url, token, path)
    uri = URI(url)
    raise Error, "Facebook gave an upload address that isn't its own." unless uri.host.to_s.end_with?(".facebook.com")

    req = Net::HTTP::Post.new(uri)
    req["Authorization"] = "OAuth #{token}"
    req["offset"] = "0"
    req["file_size"] = File.size(path).to_s
    req["Content-Type"] = "application/octet-stream"
    req.body = File.binread(path)
    request(uri, req, timeout: 120)
  end

  def request(uri, req, timeout: 30)
    res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 10, read_timeout: timeout) { |http| http.request(req) }
    body = begin
      JSON.parse(res.body.to_s)
    rescue JSON::ParserError
      {}
    end
    body = {} unless body.is_a?(Hash)
    unless res.is_a?(Net::HTTPSuccess) && !body["error"]
      err = body["error"].is_a?(Hash) ? body["error"] : {}
      raise Error.new(err["error_user_msg"].presence || err["message"].presence || "Facebook said #{res.code}.", code: err["code"])
    end
    body
  end
end
