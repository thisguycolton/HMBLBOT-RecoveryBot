require "test_helper"
require "zip"

class Api::GroupMinutesImportsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @dir = Dir.mktmpdir
    @minutes = File.join(@dir, "minutes.docx")
    xml = %(<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>MOTION: Move the workshop to Mondays. Motion passed.</w:t></w:r></w:p></w:body></w:document>)
    Zip::File.open(@minutes, create: true) { |zip| zip.get_output_stream("word/document.xml") { |f| f.write(xml) } }
  end

  teardown { FileUtils.remove_entry(@dir) }

  def path = "/api/groups/#{@group.slug}/minutes_imports"
  def upload(dry_run:) = post(path, params: { files: [Rack::Test::UploadedFile.new(@minutes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")], names: ["Minutes/2025/GC April MINUTES.docx"], dry_run: dry_run })

  test "record keepers see what the files hold, then bring them in; members can't" do
    sign_in @member
    upload(dry_run: true)
    assert_response :forbidden

    sign_in @keeper
    assert_no_difference -> { Motion.count } do
      upload(dry_run: true)
    end
    assert_response :success
    assert_equal [1, 1, "2025-04-20"], [response.parsed_body["meetings"], response.parsed_body["motions"], response.parsed_body["rows"].sole["held_on"]]

    assert_difference -> { @group.motions.count } => 1, -> { @group.business_meetings.count } => 1 do
      upload(dry_run: false)
    end

    upload(dry_run: false)
    assert_match(/already has a business meeting/, response.parsed_body["rows"].sole["skipped"])
  end
end
