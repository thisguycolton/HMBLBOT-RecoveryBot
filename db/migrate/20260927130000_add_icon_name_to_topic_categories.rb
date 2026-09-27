# Topic categories get a Lucide icon (kebab-case name, like tags.icon_name). The existing
# categories start with a fitting icon; only empty ones are filled, and rolling back drops
# the column again.
class AddIconNameToTopicCategories < ActiveRecord::Migration[8.0]
  DEFAULTS = {
    "General Recovery Principles" => "compass",
    "Gratitude" => "heart",
    "12 Steps" => "footprints",
    "Fellowship & Service" => "users",
    "Slogans & Mantras" => "quote",
    "Mindset Shifts" => "brain",
    "Special Occasions" => "party-popper",
    "Serenity Prayer" => "sunrise",
  }.freeze

  def up
    add_column :topic_categories, :icon_name, :string
    DEFAULTS.each do |title, icon|
      execute <<~SQL
        UPDATE topic_categories SET icon_name = #{quote(icon)}
        WHERE title = #{quote(title)} AND icon_name IS NULL
      SQL
    end
  end

  def down
    remove_column :topic_categories, :icon_name
  end
end
