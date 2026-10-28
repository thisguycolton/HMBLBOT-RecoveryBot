require "test_helper"

# A chip someone gives a member pops up on the pages they have open (ChipsChannel,
# Api::ChipArrivalsController, ChipArrival), once each
class Api::ChipArrivalsTest < ActionDispatch::IntegrationTest
  include ActionCable::TestHelper
  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim")
    @lee = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee")
    @group = Group.create!(title: "The Acid Test")
  end

  def give(to, **attrs) = @group.chip_awards.create!(given_by: @lee, email: to.email, milestone_key: "30d", on: Date.current, **attrs)

  test "a chip given to an account is announced on its stream, shows until seen, then marks its notification read" do
    award = give(@kim, note: "Proud of you")
    assert_broadcast_on(ChipsChannel.broadcasting_for(@kim), { type: "arrived", id: award.id }) { award.claim!(@kim) }

    sign_in @kim
    get "/api/chip_arrivals"
    assert_response :success
    chip = response.parsed_body["chips"].sole
    assert_equal ["award:#{award.id}", "Lee gave you a 30 days chip", "Proud of you", "The Acid Test"], chip.values_at("id", "title", "note") + [chip.dig("group", "title")]
    assert @kim.notifications.unread.exists?(kind: "chip.given")

    post "/api/chip_arrivals/#{award.id}/seen"
    assert_response :no_content
    assert award.reload.celebrated_at
    assert_not @kim.notifications.unread.exists?(kind: "chip.given")
    get "/api/chip_arrivals"
    assert_empty response.parsed_body["chips"]
  end

  test "only their own claimed chips, and not old ones" do
    mine = give(@kim)
    mine.claim!(@kim)
    old = give(@kim)
    old.claim!(@kim)
    old.update_columns(claimed_at: 40.days.ago)
    give(@kim) # emailed, not claimed yet
    give(@lee).claim!(@lee)

    sign_in @kim
    get "/api/chip_arrivals"
    assert_equal ["award:#{mine.id}"], response.parsed_body["chips"].map { |c| c["id"] }
    post "/api/chip_arrivals/#{@lee.chip_awards.first.id}/seen"
    assert_response :not_found
  end

  test "signed out gets nothing" do
    get "/api/chip_arrivals", as: :json
    assert_response :unauthorized
  end
end
