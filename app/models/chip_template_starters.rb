# The six chip templates RecoveryBot starts with: original art in db/chip_templates (drawn for
# RecoveryBot, not traced from anyone's coins), each with palettes and how it's best shown.
# install adds the ones that aren't there yet (by title), published, so a site admin can edit
# them like any other template. Run by a migration, and safe to run again.
module ChipTemplateStarters
  DIR = Rails.root.join("db/chip_templates")
  LIST = [
    { file: "mountains", title: "Mountains and river", fits: "both",
      defaults: { "finish" => "enamel", "metal" => "brass", "milestone_at" => "badge", "top_text" => "", "bottom_text" => "", "edge" => "plain", "palette" => "Summer" },
      palettes: {
        "Summer" => {},
        "Winter night" => { "#9fd0ee" => "#1c2a55", "#f3c43c" => "#e9edf7", "#5b4636" => "#3d4a6b", "#2f9a3e" => "#dfe7f2", "#1f5a2c" => "#1d4a3b", "#3f86d6" => "#7fa6d9" },
        "Dawn" => { "#9fd0ee" => "#f2b38a", "#f3c43c" => "#fbe26f", "#5b4636" => "#6d4b5e", "#2f9a3e" => "#5f8f4e", "#1f5a2c" => "#2e4f3a", "#3f86d6" => "#6c8fd1" },
        "Autumn" => { "#2f9a3e" => "#c07a2c", "#1f5a2c" => "#7a2e1f", "#9fd0ee" => "#bfe0f2" },
      } },
    { file: "tree", title: "Tree", fits: "round",
      defaults: { "finish" => "struck", "metal" => "black_gold", "milestone_at" => "cartouche", "top_text" => "", "bottom_text" => "", "edge" => "rope",
                  "back_text" => "Roots in what we were, branches toward the light, one day at a time.", "back_ring_top" => "Stay rooted", "back_ring_bottom" => "Reach for the light" },
      heights: { "Background" => 0.0, "Ground" => 0.45, "Roots" => 0.55, "Trunk" => 0.8, "Branches" => 0.75, "Leaves" => 1.0 },
      palettes: { "Gold on black" => {}, "Spring" => { "#17130c" => "#cfe8f5", "#d4af37" => "#4caf50", "#8a6a22" => "#6b4f2a", "#b98d2c" => "#6b4f2a" } } },
    { file: "lighthouse", title: "Lighthouse", fits: "round",
      defaults: { "finish" => "enamel", "metal" => "brass", "milestone_at" => "rim", "top_text" => "To thine own self be true", "bottom_text" => "", "edge" => "plain" },
      palettes: { "Night" => {}, "Day" => { "#1b2c52" => "#a7d3f0", "#fff6d6" => "#a7d3f0", "#f6dc76" => "#c9e6f7", "#245a8c" => "#2f80b5" } } },
    { file: "road", title: "Open road at dawn", fits: "both",
      defaults: { "finish" => "enamel", "metal" => "bronze", "milestone_at" => "badge", "top_text" => "", "bottom_text" => "", "edge" => "reeded" },
      palettes: { "Dawn" => {}, "Midday" => { "#f7c58f" => "#9fd0ee", "#e98f6f" => "#6fb3e0", "#f2a77c" => "#86c3ea", "#fde68a" => "#fff7cc", "#8e6f9e" => "#5f7f9e" } } },
    { file: "sea", title: "Sunrise over water", fits: "round",
      defaults: { "finish" => "enamel", "metal" => "silver", "milestone_at" => "badge", "top_text" => "", "bottom_text" => "", "edge" => "beads" },
      palettes: { "Morning" => {}, "Evening" => { "#fbd38d" => "#f4a3a8", "#f6ad55" => "#9b5de5", "#2c7a9b" => "#1d3b6b", "#fde68a" => "#ffd6a5" } } },
    { file: "night", title: "Night sky", fits: "both",
      defaults: { "finish" => "enamel", "metal" => "silver", "milestone_at" => "badge", "top_text" => "", "bottom_text" => "", "edge" => "plain" },
      palettes: { "Winter" => {}, "Holiday" => { "#111d3b" => "#14352b", "#fde68a" => "#e9c46a", "#1f3b4d" => "#7a1f2b", "#0f2f2a" => "#0b3d2e" } } },
  ].freeze

  module_function

  def install
    LIST.each_with_index do |s, i|
      next if ChipTemplate.site.exists?(title: s[:title])

      t = ChipTemplate.import(DIR.join("#{s[:file]}.svg").read, title: s[:title], fits: s[:fits], position: i,
                                                                source: "RecoveryBot original", license: "Owned by RecoveryBot")
      t.art["layers"].each { |l| l["height"] = s[:heights][l["name"]] if s[:heights]&.key?(l["name"]) }
      t.palettes = s[:palettes]
      t.defaults = s[:defaults]
      t.save!
      t.publish!
    end
  end
end
