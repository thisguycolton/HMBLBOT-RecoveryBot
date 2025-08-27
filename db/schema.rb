# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2025_08_27_000000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "action_text_rich_texts", force: :cascade do |t|
    t.string "name", null: false
    t.text "body"
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["record_type", "record_id", "name"], name: "index_action_text_rich_texts_uniqueness", unique: true
  end

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "add_icons_to_service_readings", force: :cascade do |t|
    t.string "icon"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "ahoy_events", force: :cascade do |t|
    t.bigint "visit_id"
    t.bigint "user_id"
    t.string "name"
    t.jsonb "properties"
    t.datetime "time"
    t.index ["name", "time"], name: "index_ahoy_events_on_name_and_time"
    t.index ["properties"], name: "index_ahoy_events_on_properties", opclass: :jsonb_path_ops, using: :gin
    t.index ["user_id"], name: "index_ahoy_events_on_user_id"
    t.index ["visit_id"], name: "index_ahoy_events_on_visit_id"
  end

  create_table "ahoy_visits", force: :cascade do |t|
    t.string "visit_token"
    t.string "visitor_token"
    t.bigint "user_id"
    t.string "ip"
    t.text "user_agent"
    t.text "referrer"
    t.string "referring_domain"
    t.text "landing_page"
    t.string "browser"
    t.string "os"
    t.string "device_type"
    t.string "country"
    t.string "region"
    t.string "city"
    t.float "latitude"
    t.float "longitude"
    t.string "utm_source"
    t.string "utm_medium"
    t.string "utm_term"
    t.string "utm_content"
    t.string "utm_campaign"
    t.string "app_version"
    t.string "os_version"
    t.string "platform"
    t.datetime "started_at"
    t.index ["user_id"], name: "index_ahoy_visits_on_user_id"
    t.index ["visit_token"], name: "index_ahoy_visits_on_visit_token", unique: true
    t.index ["visitor_token", "started_at"], name: "index_ahoy_visits_on_visitor_token_and_started_at"
  end

  create_table "books", force: :cascade do |t|
    t.string "title"
    t.string "author"
    t.string "info"
    t.string "pdf_url"
    t.date "published_date"
    t.string "purchase_link"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "aa_approved"
    t.boolean "org_approved"
    t.boolean "publicly_accessible"
    t.string "image_url"
    t.text "description"
    t.string "slug", default: "", null: false
    t.string "work_key", default: "bigbook", null: false
    t.string "edition", default: "4e", null: false
    t.string "language", default: "en", null: false
    t.jsonb "meta", default: {}, null: false
    t.index ["slug"], name: "index_books_on_slug", unique: true
    t.index ["work_key", "edition", "language"], name: "index_books_on_work_key_and_edition_and_language", unique: true
  end

  create_table "chapters", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.string "title"
    t.integer "number"
    t.text "content"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "slug"
    t.integer "index"
    t.integer "first_page"
    t.integer "last_page"
    t.jsonb "tiptap_json", default: {}, null: false
    t.string "text_hash"
    t.string "kind", default: "chapter", null: false
    t.string "label"
    t.index ["book_id", "index"], name: "index_chapters_on_book_id_and_index", unique: true
    t.index ["book_id", "slug"], name: "index_chapters_on_book_id_and_slug", unique: true
    t.index ["book_id"], name: "index_chapters_on_book_id"
  end

  create_table "groups", force: :cascade do |t|
    t.string "title"
    t.string "description"
    t.string "location"
    t.string "website"
    t.boolean "remote"
    t.string "meetingLink"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "host_props", force: :cascade do |t|
    t.string "name"
    t.string "proposed_meeting"
    t.bigint "hostificator_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hostificator_id"], name: "index_host_props_on_hostificator_id"
  end

  create_table "host_votes", force: :cascade do |t|
    t.string "session_id"
    t.bigint "hostificator_id", null: false
    t.bigint "host_prop_id", null: false
    t.integer "weight", default: 1
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["host_prop_id"], name: "index_host_votes_on_host_prop_id"
    t.index ["hostificator_id"], name: "index_host_votes_on_hostificator_id"
    t.index ["session_id", "hostificator_id"], name: "index_host_votes_on_session_id_and_hostificator_id", unique: true
  end

  create_table "hostificators", force: :cascade do |t|
    t.datetime "meeting_date_time"
    t.time "poll_closes_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "icons", force: :cascade do |t|
    t.string "name"
    t.string "file_path"
    t.string "category"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "meetings", force: :cascade do |t|
    t.timestamptz "datetime"
    t.string "host"
    t.boolean "reocurring"
    t.integer "frequency"
    t.bigint "group_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["group_id"], name: "index_meetings_on_group_id"
  end

  create_table "options", force: :cascade do |t|
    t.bigint "poll_id", null: false
    t.integer "topic_id"
    t.string "topic_title"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["poll_id"], name: "index_options_on_poll_id"
  end

  create_table "pages", force: :cascade do |t|
    t.bigint "book_id", null: false
    t.text "content"
    t.string "page_number"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["book_id"], name: "index_pages_on_book_id"
  end

  create_table "polls", force: :cascade do |t|
    t.datetime "closeDate"
    t.datetime "closeTime"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "quest_inventories", force: :cascade do |t|
    t.bigint "quest_session_id", null: false
    t.text "items"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["quest_session_id"], name: "index_quest_inventories_on_quest_session_id"
  end

  create_table "quest_players", force: :cascade do |t|
    t.string "screen_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "quest_sessions", force: :cascade do |t|
    t.bigint "quest_player_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "join_code"
    t.jsonb "game_state"
    t.index ["quest_player_id"], name: "index_quest_sessions_on_quest_player_id"
  end

  create_table "readings", force: :cascade do |t|
    t.string "title"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.date "meetingDate"
    t.time "meetingTime"
    t.string "source"
    t.string "meetingName"
    t.string "meetingUrl"
    t.string "host"
    t.bigint "group_id"
    t.index ["group_id"], name: "index_readings_on_group_id"
    t.index ["user_id"], name: "index_readings_on_user_id"
  end

  create_table "richer_text_json_texts", force: :cascade do |t|
    t.string "name", null: false
    t.text "body"
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["record_type", "record_id", "name"], name: "index_richer_texts_rich_json_uniqueness", unique: true
    t.index ["record_type", "record_id"], name: "index_richer_text_json_texts_on_record"
  end

  create_table "richer_text_o_embeds", force: :cascade do |t|
    t.json "fields"
    t.string "url"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "richer_text_rich_texts", force: :cascade do |t|
    t.string "name", null: false
    t.text "body"
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["record_type", "record_id", "name"], name: "index_richer_texts_rich_texts_uniqueness", unique: true
    t.index ["record_type", "record_id"], name: "index_richer_text_rich_texts_on_record"
  end

  create_table "service_readings", force: :cascade do |t|
    t.string "title"
    t.string "short_title"
    t.string "source"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "icon"
  end

  create_table "topic_categories", force: :cascade do |t|
    t.string "title"
    t.string "icon"
    t.string "cat"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "icon_id"
  end

  create_table "topic_sets", force: :cascade do |t|
    t.string "name"
    t.string "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "topics", force: :cascade do |t|
    t.string "title"
    t.string "searchable_number"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "subtitle"
    t.string "link"
    t.bigint "topic_category_id"
    t.bigint "topic_set_id", null: false
    t.index ["topic_category_id"], name: "index_topics_on_topic_category_id"
    t.index ["topic_set_id"], name: "index_topics_on_topic_set_id"
  end

  create_table "user_active_groups", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "group_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["group_id"], name: "index_user_active_groups_on_group_id"
    t.index ["user_id"], name: "index_user_active_groups_on_user_id"
  end

  create_table "user_highlights", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "chapter_id", null: false
    t.jsonb "selector", default: {}, null: false
    t.jsonb "style", default: {}, null: false
    t.text "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["chapter_id"], name: "index_user_highlights_on_chapter_id"
    t.index ["user_id", "chapter_id"], name: "index_user_highlights_on_user_id_and_chapter_id"
    t.index ["user_id"], name: "index_user_highlights_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "confirmation_sent_at"
    t.string "unconfirmed_email"
    t.boolean "admin"
    t.boolean "confirmed"
    t.string "share_token"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["share_token"], name: "index_users_on_share_token", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "chapters", "books"
  add_foreign_key "host_props", "hostificators"
  add_foreign_key "host_votes", "host_props"
  add_foreign_key "host_votes", "hostificators"
  add_foreign_key "meetings", "groups"
  add_foreign_key "options", "polls"
  add_foreign_key "pages", "books"
  add_foreign_key "quest_inventories", "quest_sessions"
  add_foreign_key "quest_sessions", "quest_players"
  add_foreign_key "readings", "groups"
  add_foreign_key "readings", "users"
  add_foreign_key "topics", "topic_categories"
  add_foreign_key "topics", "topic_sets"
  add_foreign_key "user_active_groups", "groups"
  add_foreign_key "user_active_groups", "users"
  add_foreign_key "user_highlights", "chapters"
  add_foreign_key "user_highlights", "users"
end
