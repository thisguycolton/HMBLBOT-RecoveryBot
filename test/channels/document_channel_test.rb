require "test_helper"

class DocumentChannelTest < ActionCable::Channel::TestCase
  self.fixture_table_names = []

  setup do
    @previous = ENV["COLLAB_EDITING"]
    ENV["COLLAB_EDITING"] = "1"
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @outsider = User.create!(email: "out@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @doc = @group.documents.create!(title: "Format", kind: "format", body: "<p>Hi</p>", visibility: "members")
    @doc.live_start!("S", 0)
  end

  teardown { ENV["COLLAB_EDITING"] = @previous }

  def join(user) = (stub_connection(current_user: user) && subscribe(group: @group.slug, id: @doc.id, client: 42))

  test "only people who can read the document listen" do
    join(@outsider)
    assert subscription.rejected?
    join(nil)
    assert subscription.rejected?
    join(@member)
    assert subscription.confirmed?
    assert_has_stream @doc.live_stream
  end

  test "keepers' edits are numbered and passed on; readers' aren't taken" do
    join(@member)
    assert_no_broadcasts(@doc.live_stream) { perform :update, update: Base64.strict_encode64("x"), epoch: 0, mid: "m1" }

    join(@keeper)
    assert_broadcast_on(@doc.live_stream, { type: "update", seq: 1, mid: "m1", update: Base64.strict_encode64("x"), from: 42 }) do
      perform :update, update: Base64.strict_encode64("x"), epoch: 0, mid: "m1"
    end
    big = Base64.strict_encode64("y" * 9_000)
    assert_broadcast_on(@doc.live_stream, { type: "update", seq: 2, mid: "m2", from: 42 }) { perform :update, update: big, epoch: 0, mid: "m2" }
    assert_equal 2, @doc.live_updates.count

    perform :update, update: Base64.strict_encode64("z"), epoch: 3, mid: "m3"
    assert_equal({ "type" => "stale", "mid" => "m3" }, transmissions.last)
  end

  test "anyone reading shares who they are" do
    join(@member)
    update = Base64.strict_encode64("who")
    assert_broadcast_on(@doc.live_stream, { type: "awareness", update: update, hello: true, from: 42 }) { perform :awareness, update: update, hello: true }
    assert_no_broadcasts(@doc.live_stream) { perform :awareness, update: "not base64!" }
  end
end
