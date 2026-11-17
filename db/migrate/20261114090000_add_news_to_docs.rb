# News in the Docs: a section can be a news section ("guides" is every other section), whose
# pages are posts with a date, a kind (Blog, Site news, Update), an optional cover picture and a
# Featured switch. Featured posts lead the News block at the top of /docs. Makes the News
# section itself, empty, so editors can start writing.
class AddNewsToDocs < ActiveRecord::Migration[8.0]
  def up
    add_column :doc_sections, :kind, :string, null: false, default: "guides"
    add_column :doc_pages, :featured, :boolean, null: false, default: false
    add_column :doc_pages, :published_at, :datetime
    add_column :doc_pages, :news_kind, :string
    add_column :doc_pages, :cover_image, :string
    add_index :doc_pages, %i[featured published_at]

    execute <<~SQL.squish
      INSERT INTO doc_sections (slug, title, summary, icon, position, kind, created_at, updated_at)
      SELECT 'news', 'News', 'Blog posts and what''s new on RecoveryBot.', 'newspaper', 0, 'news', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM doc_sections WHERE slug = 'news')
    SQL
  end

  def down
    # Posts stay, as ordinary pages of the News section; an empty News section goes
    execute "DELETE FROM doc_sections WHERE kind = 'news' AND NOT EXISTS (SELECT 1 FROM doc_pages WHERE doc_section_id = doc_sections.id)"
    remove_index :doc_pages, %i[featured published_at]
    remove_column :doc_pages, :cover_image
    remove_column :doc_pages, :news_kind
    remove_column :doc_pages, :published_at
    remove_column :doc_pages, :featured
    remove_column :doc_sections, :kind
  end
end
