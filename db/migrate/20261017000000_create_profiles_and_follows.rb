# Profile pages (laid out in the HMBLBOT Editor like group pages), following people, and
# who sees notes and highlights: only you (the default), the people following you, or
# everyone who can see profiles.
class CreateProfilesAndFollows < ActiveRecord::Migration[8.0]
  class MigrationUser < ActiveRecord::Base
    self.table_name = "users"
  end

  def up
    change_table :users, bulk: true do |t|
      t.string :username
      t.string :page_layout, null: false, default: "main_side"
      # nil until they save their own page; until then it's the default profile page
      t.jsonb :page_blocks
      t.string :default_highlight_visibility, null: false, default: "private"
      t.string :default_note_visibility, null: false, default: "private"
    end

    taken = {}
    MigrationUser.order(:id).find_each do |u|
      base = (u.name.presence || u.email.to_s.split("@").first).to_s.parameterize.first(26).sub(/-+\z/, "").presence || "member"
      base = "member" if %w[me edit].include?(base) || base.length < 2
      name = base
      n = 1
      name = "#{base}-#{n += 1}" while taken[name]
      taken[name] = true
      u.update_columns(username: name)
    end
    add_index :users, :username, unique: true

    add_column :timeline_notes, :visibility, :string, null: false, default: "private"
    add_column :user_highlights, :visibility, :string, null: false, default: "private"
    add_index :user_highlights, %i[user_id created_at]

    create_table :follows do |t|
      t.references :follower, null: false, foreign_key: { to_table: :users }
      t.references :followed, null: false, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :follows, %i[follower_id followed_id], unique: true
  end

  def down
    drop_table :follows
    remove_index :user_highlights, %i[user_id created_at]
    remove_column :user_highlights, :visibility
    remove_column :timeline_notes, :visibility
    remove_index :users, :username
    change_table :users, bulk: true do |t|
      t.remove :username, :page_layout, :page_blocks, :default_highlight_visibility, :default_note_visibility
    end
  end
end
