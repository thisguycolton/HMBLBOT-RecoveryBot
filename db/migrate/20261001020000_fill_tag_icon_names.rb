# Tags got an icon_name column (20260918172426) but existing tags started blank, so the
# reading cards showed a "?" for every tag. Give the known tags an icon (Lucide names that
# ReadingArchiveUtils' TAG_ICONS knows), matched by title. Only blank icons are filled.
class FillTagIconNames < ActiveRecord::Migration[8.0]
  ICONS = {
    "Acceptance" => "hand-heart",
    "Emotional Sobriety" => "heart",
    "Family" => "home",
    "Fellowship" => "users",
    "Finances/Money" => "wallet",
    "Fun in Sobriety" => "smile",
    "Gratitude" => "sparkles",
    "Health" => "sprout",
    "Higher Power" => "sun",
    "Holidays" => "calendar",
    "Prayer & Meditation" => "sunrise",
    "Service" => "hand-heart",
  }.freeze

  def up
    ICONS.each do |title, icon|
      execute <<~SQL
        UPDATE tags SET icon_name = #{quote(icon)}
        WHERE title = #{quote(title)} AND (icon_name IS NULL OR icon_name = '')
      SQL
    end
  end

  def down; end
end
