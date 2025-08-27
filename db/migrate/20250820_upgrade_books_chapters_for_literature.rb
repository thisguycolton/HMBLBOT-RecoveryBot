# db/migrate/20250820_upgrade_books_chapters_for_literature.rb
class UpgradeBooksChaptersForLiterature < ActiveRecord::Migration[7.1]
  def change
    # BOOKS: add identity/edition metadata
    change_table :books do |t|
      t.string :slug, null: false, default: ""       # e.g. "bigbook-4e"
      t.string :work_key, null: false, default: "bigbook"  # e.g. "bigbook", "twelve-and-twelve"
      t.string :edition, null: false, default: "4e"
      t.string :language, null: false, default: "en"
      t.jsonb  :meta, null: false, default: {}       # any extra info
    end
    add_index :books, :slug, unique: true
    add_index :books, [:work_key, :edition, :language], unique: true

    # CHAPTERS: keep your columns, add what we need
    change_table :chapters do |t|
      t.string  :slug                                 # "bigbook-4e-ch05"
      t.integer :index                                # chapter order
      t.integer :first_page
      t.integer :last_page
      t.jsonb   :tiptap_json, null: false, default: {}# Tiptap doc (rich JSON)
      t.string  :text_hash                            # integrity check
      t.string  :kind, default: "chapter", null: false # "chapter","step","appendix",...
      t.string  :label                                 # display label, e.g. "Step 5"
    end
    add_index :chapters, [:book_id, :slug], unique: true
    add_index :chapters, [:book_id, :index], unique: true

    # PAGES: keep as-is (optional to use later)
  end
end
