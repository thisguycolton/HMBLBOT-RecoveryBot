# The #hashtags and @ mentions in a highlight's note, as timeline notes keep them (Hashtags,
# Mentionable). Existing notes get their tags now; nobody is told about mentions already
# written, since nothing was a mention when they were.
class AddHashtagsAndMentionsToUserHighlights < ActiveRecord::Migration[8.0]
  class Highlight < ActiveRecord::Base
    self.table_name = "user_highlights"
  end

  def up
    add_column :user_highlights, :hashtags, :string, array: true, null: false, default: []
    add_column :user_highlights, :mentions, :jsonb, null: false, default: {}
    add_column :user_highlights, :mentioned_user_ids, :bigint, array: true, null: false, default: []
    add_index :user_highlights, :hashtags, using: :gin

    Highlight.reset_column_information
    Highlight.where("note LIKE '%#%'").find_each do |highlight|
      tags = Hashtags.in(highlight.note)
      highlight.update_columns(hashtags: tags) if tags.any?
    end
  end

  def down
    remove_index :user_highlights, :hashtags
    remove_column :user_highlights, :mentioned_user_ids
    remove_column :user_highlights, :mentions
    remove_column :user_highlights, :hashtags
  end
end
