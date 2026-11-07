# The Docs (/docs): tutorials for every tool, grouped into sections by what someone is trying to
# do, written in Markdown and edited by site admins in the docs editor. The About and History
# pages are docs pages too (path_alias "about"/"history", served at /about and /history).
# The first drafts in db/docs/ are copied in once here (here, not db:seed, which would overwrite
# edits); `bin/rails docs:import` adds later drafts without touching pages that exist.
class CreateDocs < ActiveRecord::Migration[8.0]
  def up
    create_table :doc_sections do |t|
      t.string :slug, null: false
      t.string :title, null: false
      t.text :summary
      t.string :icon
      t.integer :position, default: 0, null: false
      t.timestamps
    end
    add_index :doc_sections, :slug, unique: true

    create_table :doc_pages do |t|
      t.references :doc_section, null: false, foreign_key: { on_delete: :cascade }
      t.string :slug, null: false
      t.string :title, null: false
      t.text :summary
      t.string :icon
      t.text :body, default: "", null: false # Markdown
      t.integer :position, default: 0, null: false
      t.string :status, default: "published", null: false # draft | published
      t.string :audience, default: "everyone", null: false # everyone | members | admins
      t.string :path_alias # "about" -> /about
      t.datetime :reviewed_at
      t.references :reviewed_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :updated_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :doc_pages, %i[doc_section_id slug], unique: true
    add_index :doc_pages, :path_alias, unique: true, where: "path_alias IS NOT NULL"

    create_table :doc_page_versions do |t|
      t.references :doc_page, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false
      t.text :body, default: "", null: false
      t.references :saved_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :created_at, null: false
    end

    DocSection.reset_column_information
    DocPage.reset_column_information
    DocsImport.run
  end

  def down
    drop_table :doc_page_versions
    drop_table :doc_pages
    drop_table :doc_sections
  end
end
