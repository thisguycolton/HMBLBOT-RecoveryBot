require "test_helper"
require "zip"

class MinutesImportTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main".freeze

  setup do
    @dir = Dir.mktmpdir
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group.memberships.create!(user: @keeper, role: "admin")
    @group.memberships.create!(user: @member, role: "member")
  end

  teardown { FileUtils.remove_entry(@dir) }

  def docx(name, *paragraphs)
    path = File.join(@dir, name)
    FileUtils.mkdir_p(File.dirname(path))
    body = paragraphs.map do |p|
      list = p.start_with?("* ")
      text = ERB::Util.html_escape(p.delete_prefix("* "))
      "<w:p>#{list ? '<w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr>' : ''}<w:r><w:t>#{text}</w:t></w:r></w:p>"
    end.join
    Zip::File.open(path, create: true) do |zip|
      zip.get_output_stream("word/document.xml") { |f| f.write(%(<?xml version="1.0"?><w:document xmlns:w="#{W}"><w:body>#{body}</w:body></w:document>)) }
    end
  end

  test "a meeting per minutes file, its motions for keepers to check, and no contact details" do
    docx("2025/GC April MINUTES-2025.docx",
         "I. Chair",
         "* March Minutes: Taylor MOTION: Accept, seconded, - approved",
         "* MOTION: Add the Grapevine to approved group literature, no second. Motion did not pass.",
         "* Motion by Shelly B - Move the workshop to Mondays at 6pm",
         "* Motion passed",
         "Chair - Raul P | (555) 412-7489 | raul@example.com")
    docx("2025/GC April AGENDA-2025.docx", "MOTION: something on the agenda")
    docx("2025/Copy of GC April MINUTES-2025.docx", "I. Chair")
    docx("2020/Acid Test Minutes 03-22-2020.docx", "Set a sobriety requirement of 60 days (motion – Justin, seconded Ruth; motion passed)")

    rows = MinutesImport.new(@group, @dir, user: @keeper).run
    assert_equal 2, rows.count { |r| !r[:skipped] }

    april = @group.business_meetings.find_by!(held_on: Date.new(2025, 4, 20)) # third Sunday
    assert_equal ["held", "keepers"], [april.status, april.visibility]
    assert_includes april.minutes, "<li>"
    assert_no_match(/412-7489|raul@example\.com/, april.minutes)

    motions = april.motions.order(:id)
    assert_equal ["failed", "passed"], motions.map(&:status)
    assert_equal ["Add the Grapevine to approved group literature", "Move the workshop to Mondays at 6pm"], motions.map(&:title)
    assert_equal "Shelly B", motions.last.moved_by_name
    assert motions.all?(&:needs_review)

    early = @group.motions.find_by!(decided_on: Date.new(2020, 3, 22))
    assert_equal %w[Justin Ruth passed], [early.moved_by_name, early.seconded_by_name, early.status]

    assert_empty Motion.visible_to(@group, @member)
    assert_equal 3, Motion.visible_to(@group, @keeper).count

    assert_no_difference -> { Motion.count } do
      MinutesImport.new(@group, @dir, user: @keeper).run
    end
  end
end
