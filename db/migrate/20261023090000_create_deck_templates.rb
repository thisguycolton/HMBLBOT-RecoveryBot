# HostDeck's templates: a layout a group saved to start decks from, and the site-wide gallery
# (a group shares one, a site admin publishes it, and any group can start from it)
class CreateDeckTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :deck_templates do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.string :description
      t.string :purpose, null: false, default: "general"
      t.jsonb :arrangement, null: false, default: {}
      # none (the group's own), pending (shared, waiting for a site admin), published, declined
      t.string :gallery, null: false, default: "none"
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :reviewed_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :published_at
      t.timestamps
    end
    add_index :deck_templates, :gallery
  end
end
