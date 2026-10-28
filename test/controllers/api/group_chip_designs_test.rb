require "test_helper"

# A group's chips with template art (ChipTemplate), its own imported art, and Meeting Maker
# chips (the group's default and a meeting's own), and minting: chips already given or earned
# keep the look they had (ChipAward#design, ChipDesignVersion)
class Api::GroupChipDesignsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  SVG = <<~SVG.freeze
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g id="Sky"><rect width="100" height="60" fill="#88ccee"/></g>
      <g id="Hills"><path d="M0 60 L50 30 L100 60 L100 100 L0 100 Z" fill="#336633"/></g>
    </svg>
  SVG

  setup do
    Rails.application.reload_routes_unless_loaded
    @group = Group.create!(title: "The Acid Test")
    @other = Group.create!(title: "Other Group")
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim", sobriety_date: Date.current - 100)
    @group.memberships.create!(user: @kim, role: "admin")
    @site = ChipTemplate.import(SVG, title: "Hills", fits: "both", palettes: { "Day" => {} })
    @site.save!
    @site.publish!
    sign_in @kim
  end

  test "a group puts a site template on its round chips, and the art comes back with the design" do
    put "/api/groups/#{@group.slug}/chips", params: { design: { round: { emblem: "scene", scene: { template_id: @site.id, version: 1, finish: "struck", metal: "black_gold" } } } }, as: :json
    assert_response :success
    round = response.parsed_body.dig("design", "round")
    assert_equal ["scene", "struck", "black_gold"], [round["emblem"], round.dig("scene", "finish"), round.dig("scene", "metal")]
    assert round.dig("scene", "art", "layers").present?, "the art is put back in"
    assert_nil @group.reload.chip_design.dig("round", "scene", "art"), "but only the choice is saved"

    @site.update!(hidden: true)
    assert_equal "triangle", ChipDesign.for_group(@group)["round"]["emblem"], "hidden art falls back to the circle and triangle"
  end

  test "where the parts sit: a template's layout comes with its art, and a group can move them its own way" do
    @site.update!(defaults: { "layout" => { "round" => { "milestone" => { "x" => 0, "y" => "-30", "s" => 0.8 }, "art" => { "s" => 99 } },
                                            "layers" => { "l1" => { "x" => 4, "cx" => 50, "cy" => 50, "bad" => 1 }, "<script>" => { "x" => 1 } } } })
    assert_equal({ "round" => { "milestone" => { "x" => 0.0, "y" => -30.0, "s" => 0.8 }, "art" => { "s" => 5.0 } }, "layers" => { "l1" => { "x" => 4.0, "cx" => 50.0, "cy" => 50.0 } } },
                 @site.reload.defaults["layout"], "only numbers, sizes kept sensible")
    @site.publish!

    put "/api/groups/#{@group.slug}/chips", params: { design: { round: { emblem: "scene", scene: { template_id: @site.id } } } }, as: :json
    scene = response.parsed_body.dig("design", "round", "scene")
    assert_equal(-30.0, scene.dig("template_layout", "round", "milestone", "y"))
    assert_nil scene["layout"]

    put "/api/groups/#{@group.slug}/chips", params: { design: { round: { emblem: "scene", scene: { template_id: @site.id, layout: { triangle: { milestone: { x: 12 } } } } } } }, as: :json
    assert_equal({ "triangle" => { "milestone" => { "x" => 12.0 } } }, @group.reload.chip_design.dig("round", "scene", "layout"))
  end

  test "a group imports its own art, which only it can use, and can take it off its list" do
    post "/api/groups/#{@group.slug}/chips/templates", params: { svg: SVG, title: "Our hills" }, as: :json
    assert_response :created
    own = ChipTemplate.find(response.parsed_body["id"])
    assert_equal [@group, "published", 1], [own.group, own.status, own.versions.count]
    assert_includes ChipTemplate.usable_by(@group), own
    assert_not_includes ChipTemplate.usable_by(@other), own

    post "/api/groups/#{@group.slug}/chips/templates", params: { svg: "<svg><script>alert(1)</script></svg>" }, as: :json
    assert_response :unprocessable_entity

    delete "/api/groups/#{@group.slug}/chips/templates/#{own.id}", as: :json
    assert_response :no_content
    assert_not_includes ChipTemplate.usable_by(@group), own
  end

  test "a chip given keeps the design it was given in" do
    @group.update!(chip_design: { "round" => { "top_text" => "Keep coming back" } })
    award = @group.chip_awards.create!(email: "lee@example.com", milestone_key: "30d", on: Date.current)
    @group.update!(chip_design: { "round" => { "top_text" => "Something new" } })
    assert_equal "Keep coming back", award.reload.as_chip_json[:design]["round"]["top_text"]
  end

  test "Meeting Maker chips use the group's default unless a meeting has its own, and earned ones keep their look" do
    meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: 1, start_minute: 420)
    put "/api/groups/#{@group.slug}/chips", params: { design: { meeting: { shape: "round", color: "#224466" } } }, as: :json
    assert_response :success
    assert_equal ["round", "#224466", %w[Meeting Maker Sunrise]], ChipDesign.for_meeting(meeting.reload)["meeting"].values_at("shape", "color", "sides")
    assert_not response.parsed_body["meetings"].first["customized"]
    assert response.parsed_body["meeting_customized"]

    travel 2.days do
      put "/api/groups/#{@group.slug}/chips/meetings/#{meeting.id}", params: { design: { meeting: { color: "#aa0000" } } }, as: :json
    end
    assert_equal ["round", "#aa0000"], ChipDesign.for_meeting(Meeting.find(meeting.id))["meeting"].values_at("shape", "color"), "its own changes over the group's default"
    assert_equal "#224466", ChipDesign.for_meeting_on(meeting, Date.current)["meeting"]["color"], "a chip earned before the change keeps the old look"
    assert_equal "#aa0000", ChipDesign.for_meeting_on(meeting, Date.current + 3)["meeting"]["color"]
  end
end
