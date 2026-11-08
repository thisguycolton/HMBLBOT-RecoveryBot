# The day's Daily Reflection posted as a Facebook Page Story (and an Instagram one) every
# morning (DailyStory). One connection: which Page, its token (encrypted), when to post; and
# a row per day it posted or tried, for Site Admin > Daily story.
class CreateDailyStoryTables < ActiveRecord::Migration[8.0]
  def change
    create_table :facebook_page_connections do |t|
      t.string :page_id
      t.string :page_name
      t.text :page_token
      t.string :instagram_id
      t.string :instagram_username
      t.text :page_choices # when the account manages several Pages: which to post to
      t.references :connected_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :connected_at
      t.boolean :enabled, default: false, null: false
      t.boolean :instagram_enabled, default: false, null: false
      t.string :post_at, default: "06:00", null: false
      t.string :time_zone, default: "America/Phoenix", null: false
      t.string :look, default: "night", null: false
      t.date :posted_on
      t.datetime :posting_started_at
      t.timestamps
    end

    create_table :daily_story_posts do |t|
      t.date :on, null: false
      t.string :status, null: false # posted, partial, failed
      t.string :chapter_title
      t.integer :clips, default: 0, null: false
      t.jsonb :facebook_ids, default: [], null: false
      t.jsonb :instagram_ids, default: [], null: false
      t.text :error
      t.string :triggered_by, null: false # schedule or admin
      t.references :user, foreign_key: { on_delete: :nullify }
      t.timestamps
    end
    add_index :daily_story_posts, :on
  end
end
