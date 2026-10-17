class CreateSiteNotices < ActiveRecord::Migration[8.0]
  def change
    create_table :site_notices do |t|
      t.string :title, null: false
      t.string :summary
      t.text :body
      t.string :tone, null: false, default: "info"
      t.string :link_url
      t.string :link_label
      t.string :audience, null: false, default: "everyone"
      t.boolean :active, null: false, default: true
      t.datetime :starts_at
      t.datetime :ends_at
      t.references :user, foreign_key: { on_delete: :nullify }
      t.timestamps
    end
    add_index :site_notices, [:active, :starts_at, :ends_at]
  end
end
