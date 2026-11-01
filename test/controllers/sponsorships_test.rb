require "test_helper"

# Sponsors and sponsees (Sponsorship, Api::SponsorshipsController), what a sponsee sends
# (SponsorshipShare, Api::SponsorshipSharesController) and the invite link (/sponsor/:token)
class SponsorshipsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @sam = person("Sam") # the sponsee
    @pat = person("Pat") # the sponsor
    @lee = person("Lee")
  end

  def person(name)
    User.create!(name: name, email: "#{name.downcase}@example.com", password: "password123", password_confirmation: "password123",
                 confirmed_at: Time.current, confirmed: true)
  end

  def as(user)
    sign_out :user
    sign_in user
  end

  def ask(sponsor, note: nil)
    post "/api/sponsorships", params: { username: sponsor.username, note: note }, as: :json
  end

  def link!(sponsor = @pat, sponsee = @sam) = Sponsorship.create!(sponsor: sponsor, sponsee: sponsee, status: "active", started_on: Date.current)

  def send_list(sponsorship, body: "1. Coffee\n2. My sponsor")
    post "/api/sponsorship_shares", params: { sponsorship_ids: [sponsorship.id], kind: "gratitude", on: Date.current.iso8601,
                                              title: "My gratitude list", body: body }, as: :json
  end

  test "a sponsee asks by username, the sponsor is told and says yes" do
    as @sam
    ask @pat, note: "From the Tuesday meeting"
    assert_response :created
    s = Sponsorship.last
    assert_equal [@pat, @sam, "pending"], [s.sponsor, s.sponsee, s.status]
    assert_equal "sponsorship.request", @pat.notifications.last.kind

    as @pat
    get "/api/sponsorships"
    assert_equal ["Sam"], response.parsed_body["asking_me"].map { |r| r["person"]["name"] }
    post "/api/sponsorships/#{s.id}/accept"
    assert_response :success
    assert_equal "active", s.reload.status
    assert_equal "sponsorship.accepted", @sam.notifications.last.kind

    as @sam
    get "/api/sponsorships"
    assert_equal ["Pat"], response.parsed_body["sponsors"].map { |r| r["person"]["name"] }
  end

  test "only the person asked can say yes, and saying no isn't told" do
    as @sam
    ask @pat
    s = Sponsorship.last
    post "/api/sponsorships/#{s.id}/accept"
    assert_response :not_found
    as @pat
    assert_no_difference -> { Notification.count } do
      post "/api/sponsorships/#{s.id}/decline"
    end
    assert_equal "declined", s.reload.status
    as @sam
    get "/api/sponsorships"
    assert_equal ["declined"], response.parsed_body["my_asks"].map { |r| r["status"] }
    delete "/api/sponsorships/#{s.id}"
    assert_not Sponsorship.exists?(s.id)
  end

  test "can't ask twice, yourself, someone who blocked you, or too many at once" do
    as @sam
    ask @sam
    assert_response :unprocessable_entity
    ask @pat
    ask @pat
    assert_response :unprocessable_entity
    @lee.blocks_given.create!(blocked: @sam)
    ask @lee
    assert_response :unprocessable_entity
    ask(person("Ana"))
    ask(person("Bo"))
    ask(person("Cy"))
    assert_response :unprocessable_entity
    assert_match "waiting on 3", response.parsed_body["error"]
    post "/api/sponsorships", params: { username: "nobody-here" }, as: :json
    assert_response :not_found
  end

  test "an invite link links you once you say yes, and a new link retires the old one" do
    as @pat
    post "/api/sponsorships/invite"
    url = response.parsed_body["invite_url"]
    token = url.split("/").last

    sign_out :user
    get "/sponsor/#{token}"
    assert_redirected_to "/users/sign_up"

    as @sam
    get "/sponsor/#{token}"
    assert_redirected_to "/recovery/sponsorship?invite=#{token}"
    get "/api/sponsorships/invite/#{token}"
    assert_equal "Pat", response.parsed_body.dig("sponsor", "name")
    assert_equal 0, Sponsorship.count
    post "/api/sponsorships/invite/#{token}"
    assert_response :created
    assert Sponsorship.active.exists?(sponsor: @pat, sponsee: @sam)

    as @pat
    post "/api/sponsorships/invite", params: { reset: true }, as: :json
    assert_not_equal url, response.parsed_body["invite_url"]
    as @lee
    get "/api/sponsorships/invite/#{token}"
    assert_response :not_found
  end

  test "the sponsee sends a list, the sponsor reads it and leaves one note" do
    s = link!
    as @sam
    send_list s
    assert_response :created
    assert_equal "sponsorship.share", @pat.notifications.last.kind
    send_list s, body: "1. Coffee\n2. My sponsor\n3. Sunshine" # again before it's read: replaced
    assert_equal 1, s.shares.count
    assert_includes s.shares.first.body, "Sunshine"

    as @pat
    get "/api/sponsorships"
    assert_equal 1, response.parsed_body["sponsees"].first["unseen"]
    get "/api/sponsorships/#{s.id}/shares"
    assert_equal ["My gratitude list"], response.parsed_body["shares"].map { |r| r["title"] }
    assert s.shares.first.seen_at
    share = s.shares.first
    patch "/api/sponsorship_shares/#{share.id}", params: { reply: "Proud of you." }, as: :json
    assert_response :success
    assert_equal "sponsorship.reply", @sam.notifications.last.kind
    patch "/api/sponsorship_shares/#{share.id}", params: { reply: "x" * 501 }, as: :json
    assert_response :unprocessable_entity

    as @sam
    get "/api/sponsorships/#{s.id}/shares"
    assert_equal "Proud of you.", response.parsed_body["shares"].first["reply"]
    patch "/api/sponsorship_shares/#{share.id}", params: { reply: "I'm the sponsee" }, as: :json
    assert_response :not_found
    send_list s # read already, so a new one
    assert_equal 2, s.shares.count
    delete "/api/sponsorship_shares/#{share.id}"
    assert_equal 1, s.shares.count
  end

  test "nobody else can send or read" do
    s = link!
    as @lee
    send_list s
    assert_response :unprocessable_entity
    get "/api/sponsorships/#{s.id}/shares"
    assert_response :not_found
    as @pat # the sponsor can't send things as the sponsee
    send_list s
    assert_response :unprocessable_entity
  end

  test "either of them can end it, nobody is told, and what was sent goes" do
    s = link!
    as @sam
    send_list s
    as @pat
    assert_no_difference -> { Notification.count } do
      delete "/api/sponsorships/#{s.id}"
    end
    assert_equal "ended", s.reload.status
    assert_equal 0, SponsorshipShare.count
    get "/api/sponsorships/#{s.id}/shares"
    assert_response :not_found
    as @sam
    ask @pat # they can ask again later
    assert_response :created
  end

  test "blocking ends it" do
    s = link!
    as @sam
    send_list s
    @sam.blocks_given.create!(blocked: @pat)
    assert_equal "ended", s.reload.status
    assert_equal 0, SponsorshipShare.count
  end
end
