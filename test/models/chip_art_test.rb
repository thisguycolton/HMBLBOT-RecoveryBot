require "test_helper"

# Importing SVG art for illustrated chips (ChipArt) and templates made from it (ChipTemplate)
class ChipArtTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  SVG = <<~SVG
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 100 100">
      <style>.sky { fill: #9FD0EE }</style>
      <script>alert(1)</script>
      <rect width="100" height="100" fill="#000"/>
      <g inkscape:label="Sky"><rect class="sky" width="100" height="60"/></g>
      <g data-name="Hills" transform="translate(0 10)">
        <polygon points="0,60 50,30 100,60" fill="rgb(91,70,54)" stroke="#c9a24a" stroke-width="2"/>
        <image href="https://example.com/x.png" width="10" height="10"/>
      </g>
      <g id="sun_rays"><line x1="50" y1="40" x2="50" y2="5" stroke="gold"/></g>
      <g id="empty"/>
    </svg>
  SVG

  test "layers come from top-level groups, with colors, outlines and roles, and nothing else" do
    art = ChipArt.from_svg(SVG)
    assert_equal [0, 0, 100, 100], art["view_box"].map(&:to_i)
    assert_equal ["Layer", "Sky", "Hills", "sun rays"], art["layers"].map { |l| l["name"] }
    assert_equal %w[enamel enamel enamel line], art["layers"].map { |l| l["role"] }
    hills = art["layers"][2]["shapes"].first
    assert_equal ["#5b4636", "#c9a24a", 2.0, "translate(0 10)"], hills.values_at("fill", "stroke", "sw", "t")
    assert_equal "#9fd0ee", art["layers"][1]["shapes"].first["fill"]
    assert_equal "#ffd700", art["layers"][3]["shapes"].first["stroke"]
    assert_equal art["layers"].flat_map { |l| l["shapes"].map { |s| s["id"] } }.uniq.size, art["layers"].sum { |l| l["shapes"].size }
    assert_not art.to_json.include?("alert")
    assert_not art.to_json.include?("example.com")
  end

  test "what isn't usable says why" do
    assert_raises(ChipArt::Invalid) { ChipArt.from_svg("<html></html>") }
    assert_raises(ChipArt::Invalid) { ChipArt.from_svg(%(<svg xmlns="http://www.w3.org/2000/svg"><image href="x.png"/></svg>)) }
    assert_raises(ChipArt::Invalid) { ChipArt.from_svg(%(<svg xmlns="http://www.w3.org/2000/svg"><text>Hi</text></svg>)) }
  end

  test "art sent back from the editor is checked again" do
    art = ChipArt.from_svg(SVG)
    art["layers"][1]["role"] = "bogus"
    art["layers"][1]["shapes"] << { "id" => "evil", "d" => "M0 0 <script>", "fill" => "#fff" }
    art["layers"][1]["shapes"].first["fill"] = "javascript:alert(1)"
    clean = ChipArt.clean(art)
    assert_equal "enamel", clean["layers"][1]["role"]
    assert_equal 1, clean["layers"][1]["shapes"].size
    assert_nil clean["layers"][1]["shapes"].first["fill"]
  end

  test "a template's palettes keep only the art's colors, and publishing freezes a version" do
    t = ChipTemplate.import(SVG, title: "Hills")
    t.palettes = { "Night" => { "#9fd0ee" => "#1c2a55", "#123456" => "#000000", "#5b4636" => "nope" } }
    t.defaults = { "finish" => "struck", "metal" => "black_gold", "milestone_at" => "cartouche", "bogus" => 1 }
    t.save!
    assert_equal({ "Night" => { "#9fd0ee" => "#1c2a55" } }, t.palettes)
    assert_equal({ "finish" => "struck", "metal" => "black_gold", "milestone_at" => "cartouche" }, t.defaults)

    v1 = t.publish!
    assert_equal 1, v1.number
    t.update!(title: "Hills at night", palettes: { "Night" => { "#9fd0ee" => "#000000" } })
    assert_equal "#1c2a55", v1.reload.palettes.dig("Night", "#9fd0ee"), "published versions don't change"
    assert_equal 2, t.publish!.number
  end

  test "the starters install once, published, and a design shows one" do
    ChipTemplateStarters.install
    ChipTemplateStarters.install
    assert_equal 6, ChipTemplate.site.published.count
    tree = ChipTemplate.find_by!(title: "Tree")
    assert_equal 1.0, tree.latest.art["layers"].find { |l| l["name"] == "Leaves" }["height"]

    design = ChipDesign.resolve(ChipDesign.merge("round" => { "emblem" => "scene", "scene" => { "template_id" => tree.id, "palette" => "Spring" } }))
    assert_equal ["Tree", 1], design["round"]["scene"].values_at("title", "version")
    assert_equal "#4caf50", design["round"]["scene"]["colors"]["#d4af37"]
    assert design["round"]["scene"]["art"]["layers"].any?

    tree.update!(hidden: true)
    design = ChipDesign.resolve(ChipDesign.merge("round" => { "emblem" => "scene", "scene" => { "template_id" => tree.id } }))
    assert_equal "triangle", design["round"]["emblem"], "hidden art falls back to the circle and triangle"
  end
end
