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

ActiveRecord::Schema[8.0].define(version: 2026_10_20_200000) do
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

  create_table "agenda_items", force: :cascade do |t|
    t.bigint "business_meeting_id", null: false
    t.bigint "submitted_by_id"
    t.integer "position", default: 0, null: false
    t.string "kind", default: "new_business", null: false
    t.string "title", null: false
    t.text "details"
    t.string "status", default: "on_agenda", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "motion_id"
    t.index ["business_meeting_id"], name: "index_agenda_items_on_business_meeting_id"
    t.index ["motion_id"], name: "index_agenda_items_on_motion_id"
    t.index ["submitted_by_id"], name: "index_agenda_items_on_submitted_by_id"
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
    t.string "cover_color"
    t.index ["slug"], name: "index_books_on_slug", unique: true
    t.index ["work_key", "edition", "language"], name: "index_books_on_work_key_and_edition_and_language", unique: true
  end

  create_table "business_meetings", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "created_by_id"
    t.bigint "event_id"
    t.bigint "meeting_id"
    t.date "held_on", null: false
    t.datetime "starts_at"
    t.string "status", default: "planned", null: false
    t.string "chair_name"
    t.string "secretary_name"
    t.integer "attendance_count"
    t.text "minutes"
    t.string "minutes_status", default: "draft", null: false
    t.datetime "minutes_posted_at"
    t.datetime "minutes_approved_at"
    t.string "visibility", default: "members", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "called_to_order_at"
    t.datetime "adjourned_at"
    t.index ["created_by_id"], name: "index_business_meetings_on_created_by_id"
    t.index ["event_id"], name: "index_business_meetings_on_event_id"
    t.index ["group_id", "held_on"], name: "index_business_meetings_on_group_id_and_held_on"
    t.index ["group_id"], name: "index_business_meetings_on_group_id"
    t.index ["meeting_id"], name: "index_business_meetings_on_meeting_id"
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

  create_table "contact_requests", force: :cascade do |t|
    t.string "name"
    t.string "email", null: false
    t.string "topic", default: "general", null: false
    t.text "message", null: false
    t.bigint "user_id"
    t.string "status", default: "open", null: false
    t.datetime "handled_at"
    t.bigint "handled_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["handled_by_id"], name: "index_contact_requests_on_handled_by_id"
    t.index ["status", "created_at"], name: "index_contact_requests_on_status_and_created_at"
    t.index ["user_id"], name: "index_contact_requests_on_user_id"
  end

  create_table "court_verifications", force: :cascade do |t|
    t.string "respondent_name", null: false
    t.string "respondent_email", null: false
    t.datetime "meeting_at", null: false
    t.string "host_name", null: false
    t.string "signer_name", null: false
    t.string "topic", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "group_id"
    t.bigint "meeting_id"
    t.index ["group_id"], name: "index_court_verifications_on_group_id"
    t.index ["meeting_at"], name: "index_court_verifications_on_meeting_at"
    t.index ["meeting_id"], name: "index_court_verifications_on_meeting_id"
    t.index ["respondent_email"], name: "index_court_verifications_on_respondent_email"
  end

  create_table "event_collaborators", force: :cascade do |t|
    t.bigint "event_id", null: false
    t.bigint "user_id", null: false
    t.bigint "added_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["added_by_id"], name: "index_event_collaborators_on_added_by_id"
    t.index ["event_id", "user_id"], name: "index_event_collaborators_on_event_id_and_user_id", unique: true
    t.index ["event_id"], name: "index_event_collaborators_on_event_id"
    t.index ["user_id"], name: "index_event_collaborators_on_user_id"
  end

  create_table "event_rsvps", force: :cascade do |t|
    t.bigint "event_id", null: false
    t.bigint "user_id"
    t.string "email"
    t.string "name"
    t.string "status", default: "going", null: false
    t.string "token", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "event_id, lower((email)::text)", name: "index_event_rsvps_on_event_and_guest_email", unique: true, where: "(user_id IS NULL)"
    t.index ["event_id", "user_id"], name: "index_event_rsvps_on_event_id_and_user_id", unique: true, where: "(user_id IS NOT NULL)"
    t.index ["event_id"], name: "index_event_rsvps_on_event_id"
    t.index ["token"], name: "index_event_rsvps_on_token", unique: true
    t.index ["user_id"], name: "index_event_rsvps_on_user_id"
  end

  create_table "event_updates", force: :cascade do |t|
    t.bigint "event_id", null: false
    t.bigint "created_by_id"
    t.string "block_id"
    t.string "kind", null: false
    t.string "title", null: false
    t.text "body"
    t.integer "recipients_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_event_updates_on_created_by_id"
    t.index ["event_id"], name: "index_event_updates_on_event_id"
  end

  create_table "events", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "created_by_id"
    t.string "token", null: false
    t.string "title", null: false
    t.string "short_description"
    t.string "layout", default: "main_side", null: false
    t.string "status", default: "draft", null: false
    t.string "time_zone", default: "America/Phoenix", null: false
    t.datetime "starts_at"
    t.datetime "ends_at"
    t.string "location"
    t.jsonb "blocks", default: [], null: false
    t.datetime "published_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_events_on_created_by_id"
    t.index ["group_id"], name: "index_events_on_group_id"
    t.index ["token"], name: "index_events_on_token", unique: true
  end

  create_table "follows", force: :cascade do |t|
    t.bigint "follower_id", null: false
    t.bigint "followed_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["followed_id"], name: "index_follows_on_followed_id"
    t.index ["follower_id", "followed_id"], name: "index_follows_on_follower_id_and_followed_id", unique: true
    t.index ["follower_id"], name: "index_follows_on_follower_id"
  end

  create_table "group_books", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "book_id", null: false
    t.string "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["book_id"], name: "index_group_books_on_book_id"
    t.index ["group_id", "book_id"], name: "index_group_books_on_group_id_and_book_id", unique: true
    t.index ["group_id"], name: "index_group_books_on_group_id"
  end

  create_table "group_document_templates", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.string "kind", null: false
    t.string "mark", default: "none", null: false
    t.string "header_text"
    t.string "subheader_text"
    t.string "footer_text"
    t.string "align", default: "center", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["group_id", "kind"], name: "index_group_document_templates_on_group_id_and_kind", unique: true
    t.index ["group_id"], name: "index_group_document_templates_on_group_id"
  end

  create_table "group_document_versions", force: :cascade do |t|
    t.bigint "group_document_id", null: false
    t.bigint "user_id"
    t.string "title", null: false
    t.text "body"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "body_format", default: "html", null: false
    t.index ["group_document_id"], name: "index_group_document_versions_on_group_document_id"
    t.index ["user_id"], name: "index_group_document_versions_on_user_id"
  end

  create_table "group_documents", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "created_by_id"
    t.bigint "updated_by_id"
    t.string "title", null: false
    t.string "kind", default: "other", null: false
    t.text "body"
    t.string "visibility", default: "members", null: false
    t.string "status", default: "current", null: false
    t.boolean "pinned", default: false, null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "approved_by_motion_id"
    t.string "body_format", default: "html", null: false
    t.index ["approved_by_motion_id"], name: "index_group_documents_on_approved_by_motion_id"
    t.index ["created_by_id"], name: "index_group_documents_on_created_by_id"
    t.index ["group_id", "kind", "position"], name: "index_group_documents_on_group_id_and_kind_and_position"
    t.index ["group_id"], name: "index_group_documents_on_group_id"
    t.index ["updated_by_id"], name: "index_group_documents_on_updated_by_id"
  end

  create_table "group_memberships", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "user_id", null: false
    t.string "role", default: "member", null: false
    t.string "status", default: "active", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "can_keep_records", default: false, null: false
    t.boolean "can_schedule_hosts", default: false, null: false
    t.boolean "can_keep_treasury", default: false, null: false
    t.boolean "can_host", default: false, null: false
    t.index ["group_id", "user_id"], name: "index_group_memberships_on_group_id_and_user_id", unique: true
    t.index ["group_id"], name: "index_group_memberships_on_group_id"
    t.index ["user_id"], name: "index_group_memberships_on_user_id"
  end

  create_table "group_page_templates", force: :cascade do |t|
    t.string "key", null: false
    t.string "layout", default: "main_side", null: false
    t.jsonb "blocks", default: [], null: false
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_group_page_templates_on_key", unique: true
    t.index ["updated_by_id"], name: "index_group_page_templates_on_updated_by_id"
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
    t.string "slug"
    t.string "time_zone", default: "America/Phoenix", null: false
    t.string "join_token"
    t.string "status", default: "active", null: false
    t.bigint "created_by_id"
    t.string "court_email_subject"
    t.text "court_email_body"
    t.string "court_email_reply_to"
    t.string "page_layout", default: "main_side", null: false
    t.jsonb "page_blocks"
    t.integer "quorum_count"
    t.integer "quorum_percent"
    t.boolean "follows_roberts_rules", default: true, null: false
    t.boolean "show_hosts_publicly", default: true, null: false
    t.index ["created_by_id"], name: "index_groups_on_created_by_id"
    t.index ["join_token"], name: "index_groups_on_join_token", unique: true
    t.index ["slug"], name: "index_groups_on_slug", unique: true
  end

  create_table "host_chat_postings", force: :cascade do |t|
    t.bigint "hosting_kit_id", null: false
    t.string "title", null: false
    t.string "icon"
    t.integer "minute", default: 0, null: false
    t.text "body", default: "", null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hosting_kit_id"], name: "index_host_chat_postings_on_hosting_kit_id"
  end

  create_table "host_props", force: :cascade do |t|
    t.string "name"
    t.string "proposed_meeting"
    t.bigint "hostificator_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hostificator_id"], name: "index_host_props_on_hostificator_id"
  end

  create_table "host_sub_requests", force: :cascade do |t|
    t.bigint "meeting_id", null: false
    t.bigint "requested_by_id"
    t.bigint "filled_by_id"
    t.string "role", null: false
    t.date "on", null: false
    t.string "note"
    t.string "status", default: "open", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["filled_by_id"], name: "index_host_sub_requests_on_filled_by_id"
    t.index ["meeting_id", "role", "on", "status"], name: "idx_on_meeting_id_role_on_status_9ed0303692"
    t.index ["meeting_id"], name: "index_host_sub_requests_on_meeting_id"
    t.index ["requested_by_id"], name: "index_host_sub_requests_on_requested_by_id"
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

  create_table "hosting_kits", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "meeting_id"
    t.bigint "script_document_id"
    t.jsonb "readings", default: [], null: false
    t.text "activity_anchor"
    t.jsonb "service_roles"
    t.boolean "public_postings", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["group_id"], name: "index_hosting_kits_on_group_id"
    t.index ["group_id"], name: "index_hosting_kits_one_default", unique: true, where: "(meeting_id IS NULL)"
    t.index ["meeting_id"], name: "index_hosting_kits_one_per_meeting", unique: true, where: "(meeting_id IS NOT NULL)"
    t.index ["script_document_id"], name: "index_hosting_kits_on_script_document_id"
  end

  create_table "hosting_presences", force: :cascade do |t|
    t.bigint "hosting_session_id", null: false
    t.bigint "user_id", null: false
    t.string "activity"
    t.integer "section_index"
    t.datetime "last_seen_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hosting_session_id", "user_id"], name: "index_hosting_presences_on_hosting_session_id_and_user_id", unique: true
    t.index ["hosting_session_id"], name: "index_hosting_presences_on_hosting_session_id"
    t.index ["user_id"], name: "index_hosting_presences_on_user_id"
  end

  create_table "hosting_sessions", force: :cascade do |t|
    t.bigint "meeting_id", null: false
    t.date "on", null: false
    t.integer "section_index", default: 0, null: false
    t.jsonb "completed", default: [], null: false
    t.jsonb "posted", default: {}, null: false
    t.jsonb "log", default: [], null: false
    t.jsonb "activity"
    t.jsonb "service", default: {}, null: false
    t.jsonb "milestones", default: [], null: false
    t.datetime "timer_started_at"
    t.integer "timer_banked", default: 0, null: false
    t.integer "version", default: 0, null: false
    t.string "code", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_hosting_sessions_on_code", unique: true
    t.index ["meeting_id", "on"], name: "index_hosting_sessions_on_meeting_id_and_on", unique: true
    t.index ["meeting_id"], name: "index_hosting_sessions_on_meeting_id"
  end

  create_table "icons", force: :cascade do |t|
    t.string "name"
    t.string "file_path"
    t.string "category"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "intergroup_follows", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "group_name", null: false
    t.string "oiaa_slug", null: false
    t.datetime "notified_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["group_name"], name: "index_intergroup_follows_on_group_name"
    t.index ["user_id", "group_name"], name: "index_intergroup_follows_on_user_id_and_group_name", unique: true
    t.index ["user_id"], name: "index_intergroup_follows_on_user_id"
  end

  create_table "meeting_host_covers", force: :cascade do |t|
    t.bigint "meeting_id", null: false
    t.bigint "user_id"
    t.string "role", null: false
    t.string "name", null: false
    t.date "on", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["meeting_id", "role", "on"], name: "index_meeting_host_covers_on_meeting_id_and_role_and_on", unique: true
    t.index ["meeting_id"], name: "index_meeting_host_covers_on_meeting_id"
    t.index ["user_id"], name: "index_meeting_host_covers_on_user_id"
  end

  create_table "meeting_host_reminders", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "meeting_id", null: false
    t.string "role", null: false
    t.date "on", null: false
    t.datetime "created_at", null: false
    t.index ["meeting_id"], name: "index_meeting_host_reminders_on_meeting_id"
    t.index ["user_id", "meeting_id", "role", "on"], name: "index_meeting_host_reminders_once", unique: true
    t.index ["user_id"], name: "index_meeting_host_reminders_on_user_id"
  end

  create_table "meeting_hosts", force: :cascade do |t|
    t.bigint "meeting_id", null: false
    t.bigint "user_id"
    t.string "role", null: false
    t.string "name", null: false
    t.date "starts_on", null: false
    t.date "ends_on"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["meeting_id", "role", "starts_on"], name: "index_meeting_hosts_on_meeting_id_and_role_and_starts_on"
    t.index ["meeting_id"], name: "index_meeting_hosts_on_meeting_id"
    t.index ["user_id"], name: "index_meeting_hosts_on_user_id"
  end

  create_table "meetings", force: :cascade do |t|
    t.timestamptz "datetime"
    t.string "host"
    t.boolean "reocurring"
    t.integer "frequency"
    t.bigint "group_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.string "recurrence", default: "weekly", null: false
    t.integer "day_of_week"
    t.integer "start_minute"
    t.integer "end_minute"
    t.datetime "starts_at"
    t.datetime "ends_at"
    t.string "time_zone", default: "America/Phoenix", null: false
    t.string "conference_url"
    t.string "conference_url_notes"
    t.string "conference_phone"
    t.string "location"
    t.string "formatted_address"
    t.string "types", default: [], null: false, array: true
    t.text "notes"
    t.string "source", default: "manual", null: false
    t.string "oiaa_slug"
    t.string "oiaa_url"
    t.datetime "oiaa_synced_at"
    t.boolean "oiaa_missing", default: false, null: false
    t.index ["group_id"], name: "index_meetings_on_group_id"
    t.index ["oiaa_slug"], name: "index_meetings_on_oiaa_slug"
  end

  create_table "motions", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "created_by_id"
    t.string "title", null: false
    t.text "text"
    t.string "moved_by_name"
    t.string "seconded_by_name"
    t.string "status", default: "passed", null: false
    t.integer "votes_for"
    t.integer "votes_against"
    t.integer "abstentions"
    t.text "minority_opinion"
    t.date "decided_on"
    t.string "category", default: "other", null: false
    t.bigint "supersedes_id"
    t.string "visibility", default: "members", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "business_meeting_id"
    t.bigint "agenda_item_id"
    t.string "kind", default: "main", null: false
    t.bigint "parent_id"
    t.string "vote_method"
    t.string "required_vote"
    t.boolean "previous_notice", default: false, null: false
    t.string "committee"
    t.string "postponed_to"
    t.text "amended_text"
    t.text "note"
    t.boolean "needs_review", default: false, null: false
    t.boolean "ignore_rules", default: false, null: false
    t.boolean "imported", default: false, null: false
    t.boolean "one_time", default: false, null: false
    t.index ["agenda_item_id"], name: "index_motions_on_agenda_item_id"
    t.index ["business_meeting_id"], name: "index_motions_on_business_meeting_id"
    t.index ["created_by_id"], name: "index_motions_on_created_by_id"
    t.index ["group_id", "decided_on"], name: "index_motions_on_group_id_and_decided_on"
    t.index ["group_id"], name: "index_motions_on_group_id"
    t.index ["parent_id"], name: "index_motions_on_parent_id"
    t.index ["supersedes_id"], name: "index_motions_on_supersedes_id"
  end

  create_table "note_comments", force: :cascade do |t|
    t.bigint "timeline_note_id", null: false
    t.bigint "user_id", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["timeline_note_id", "created_at"], name: "index_note_comments_on_timeline_note_id_and_created_at"
    t.index ["user_id"], name: "index_note_comments_on_user_id"
  end

  create_table "note_reactions", force: :cascade do |t|
    t.string "reactable_type", null: false
    t.bigint "reactable_id", null: false
    t.bigint "user_id", null: false
    t.string "kind", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["reactable_type", "reactable_id", "user_id"], name: "index_note_reactions_on_reactable_and_user", unique: true
    t.index ["user_id"], name: "index_note_reactions_on_user_id"
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "kind", null: false
    t.string "title", null: false
    t.text "body"
    t.string "url"
    t.datetime "read_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "created_at"], name: "index_notifications_on_user_id_and_created_at"
    t.index ["user_id", "read_at"], name: "index_notifications_on_user_id_and_read_at"
    t.index ["user_id"], name: "index_notifications_on_user_id"
  end

  create_table "oiaa_meetings", force: :cascade do |t|
    t.string "slug", null: false
    t.string "name", null: false
    t.string "group_name"
    t.integer "days", default: [], null: false, array: true
    t.string "start_time"
    t.string "end_time"
    t.string "time_zone"
    t.string "conference_url"
    t.string "conference_url_notes"
    t.string "conference_phone"
    t.string "conference_id"
    t.string "types", default: [], null: false, array: true
    t.text "notes"
    t.string "url"
    t.datetime "last_seen_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "attendance_option"
    t.string "location"
    t.string "formatted_address"
    t.string "region"
    t.index ["conference_id"], name: "index_oiaa_meetings_on_conference_id"
    t.index ["last_seen_at"], name: "index_oiaa_meetings_on_last_seen_at"
    t.index ["slug"], name: "index_oiaa_meetings_on_slug", unique: true
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

  create_table "quest_log_entries", force: :cascade do |t|
    t.bigint "quest_session_id", null: false
    t.string "kind", null: false
    t.string "encounter"
    t.bigint "topic_id"
    t.string "sharing_mode_key"
    t.string "approach"
    t.jsonb "data", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["quest_session_id", "kind"], name: "index_quest_log_entries_on_quest_session_id_and_kind"
    t.index ["quest_session_id"], name: "index_quest_log_entries_on_quest_session_id"
    t.index ["topic_id"], name: "index_quest_log_entries_on_topic_id"
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
    t.bigint "topic_set_id"
    t.string "status", default: "active", null: false
    t.datetime "completed_at"
    t.string "name"
    t.index ["quest_player_id"], name: "index_quest_sessions_on_quest_player_id"
    t.index ["topic_set_id"], name: "index_quest_sessions_on_topic_set_id"
  end

  create_table "quest_stories", force: :cascade do |t|
    t.bigint "quest_session_id", null: false
    t.string "style", null: false
    t.string "title"
    t.text "body", null: false
    t.string "model"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["quest_session_id"], name: "index_quest_stories_on_quest_session_id"
  end

  create_table "reading_tags", force: :cascade do |t|
    t.bigint "reading_id", null: false
    t.bigint "tag_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["reading_id", "tag_id"], name: "index_reading_tags_on_reading_id_and_tag_id", unique: true
    t.index ["reading_id"], name: "index_reading_tags_on_reading_id"
    t.index ["tag_id"], name: "index_reading_tags_on_tag_id"
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
    t.datetime "published_at"
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

  create_table "schedule_poll_ballots", force: :cascade do |t|
    t.bigint "schedule_poll_id", null: false
    t.bigint "user_id"
    t.string "voter_name"
    t.string "voter_token", null: false
    t.string "ip_digest"
    t.jsonb "choices", default: [], null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["schedule_poll_id", "ip_digest"], name: "index_schedule_poll_ballots_on_schedule_poll_id_and_ip_digest"
    t.index ["schedule_poll_id", "user_id"], name: "index_schedule_poll_ballots_on_schedule_poll_id_and_user_id", unique: true, where: "(user_id IS NOT NULL)"
    t.index ["schedule_poll_id", "voter_token"], name: "idx_on_schedule_poll_id_voter_token_4f9b648c21", unique: true
    t.index ["schedule_poll_id"], name: "index_schedule_poll_ballots_on_schedule_poll_id"
    t.index ["user_id"], name: "index_schedule_poll_ballots_on_user_id"
  end

  create_table "schedule_poll_members", force: :cascade do |t|
    t.bigint "schedule_poll_id", null: false
    t.bigint "user_id", null: false
    t.string "role", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["schedule_poll_id", "user_id"], name: "index_schedule_poll_members_on_schedule_poll_id_and_user_id", unique: true
    t.index ["schedule_poll_id"], name: "index_schedule_poll_members_on_schedule_poll_id"
    t.index ["user_id"], name: "index_schedule_poll_members_on_user_id"
  end

  create_table "schedule_polls", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "token", null: false
    t.string "title", null: false
    t.text "description"
    t.string "time_zone", default: "America/Phoenix", null: false
    t.date "starts_on", null: false
    t.date "ends_on", null: false
    t.integer "duration_minutes", default: 60, null: false
    t.integer "choices_count", default: 3, null: false
    t.integer "slot_minutes", default: 30, null: false
    t.integer "day_start_minute", default: 480, null: false
    t.integer "day_end_minute", default: 1380, null: false
    t.string "results_visibility", default: "after_vote", null: false
    t.jsonb "blocks", default: [], null: false
    t.datetime "closes_at", null: false
    t.datetime "closed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "event_id"
    t.index ["event_id"], name: "index_schedule_polls_on_event_id"
    t.index ["token"], name: "index_schedule_polls_on_token", unique: true
    t.index ["user_id"], name: "index_schedule_polls_on_user_id"
  end

  create_table "service_positions", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.string "title", null: false
    t.text "description"
    t.integer "term_months"
    t.integer "sobriety_months"
    t.integer "position", default: 0, null: false
    t.boolean "archived", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["group_id"], name: "index_service_positions_on_group_id"
  end

  create_table "service_readings", force: :cascade do |t|
    t.string "title"
    t.string "short_title"
    t.string "source"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "icon"
  end

  create_table "service_terms", force: :cascade do |t|
    t.bigint "service_position_id", null: false
    t.bigint "user_id"
    t.string "name", null: false
    t.date "starts_on", null: false
    t.date "ends_on"
    t.datetime "reminded_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["service_position_id"], name: "index_service_terms_on_service_position_id"
    t.index ["user_id"], name: "index_service_terms_on_user_id"
  end

  create_table "sharing_modes", force: :cascade do |t|
    t.string "key", null: false
    t.string "name", null: false
    t.string "icon_name"
    t.text "prompt", null: false
    t.boolean "gentle", default: false, null: false
    t.integer "position", default: 0, null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_sharing_modes_on_key", unique: true
  end

  create_table "site_notices", force: :cascade do |t|
    t.string "title", null: false
    t.string "summary"
    t.text "body"
    t.string "tone", default: "info", null: false
    t.string "link_url"
    t.string "link_label"
    t.string "audience", default: "everyone", null: false
    t.boolean "active", default: true, null: false
    t.datetime "starts_at"
    t.datetime "ends_at"
    t.bigint "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active", "starts_at", "ends_at"], name: "index_site_notices_on_active_and_starts_at_and_ends_at"
    t.index ["user_id"], name: "index_site_notices_on_user_id"
  end

  create_table "tags", force: :cascade do |t|
    t.string "title"
    t.text "description"
    t.string "icon"
    t.string "slug"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "icon_name"
  end

  create_table "text_report_comments", force: :cascade do |t|
    t.bigint "text_report_id", null: false
    t.bigint "user_id", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["text_report_id"], name: "index_text_report_comments_on_text_report_id"
    t.index ["user_id"], name: "index_text_report_comments_on_user_id"
  end

  create_table "text_reports", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "chapter_id", null: false
    t.jsonb "selector", default: {}, null: false
    t.text "message", null: false
    t.string "status", default: "open", null: false
    t.datetime "resolved_at"
    t.bigint "resolved_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["chapter_id"], name: "index_text_reports_on_chapter_id"
    t.index ["resolved_by_id"], name: "index_text_reports_on_resolved_by_id"
    t.index ["status", "created_at"], name: "index_text_reports_on_status_and_created_at"
    t.index ["user_id"], name: "index_text_reports_on_user_id"
  end

  create_table "timeline_note_shares", force: :cascade do |t|
    t.bigint "timeline_note_id", null: false
    t.bigint "group_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["group_id", "created_at"], name: "index_timeline_note_shares_on_group_id_and_created_at"
    t.index ["group_id"], name: "index_timeline_note_shares_on_group_id"
    t.index ["timeline_note_id", "group_id"], name: "index_timeline_note_shares_on_timeline_note_id_and_group_id", unique: true
    t.index ["timeline_note_id"], name: "index_timeline_note_shares_on_timeline_note_id"
  end

  create_table "timeline_notes", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "visibility", default: "private", null: false
    t.bigint "repost_of_id"
    t.jsonb "link_preview"
    t.index ["repost_of_id", "user_id"], name: "index_timeline_notes_on_repost_of_id_and_user_id", unique: true, where: "(repost_of_id IS NOT NULL)"
    t.index ["user_id", "created_at"], name: "index_timeline_notes_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_timeline_notes_on_user_id"
  end

  create_table "topic_categories", force: :cascade do |t|
    t.string "title"
    t.string "icon"
    t.string "cat"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "icon_id"
    t.string "icon_name"
  end

  create_table "topic_sets", force: :cascade do |t|
    t.string "name"
    t.string "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "topic_sharing_prompts", force: :cascade do |t|
    t.bigint "topic_id", null: false
    t.bigint "sharing_mode_id", null: false
    t.text "text"
    t.string "status", default: "draft", null: false
    t.string "source", default: "human", null: false
    t.boolean "enabled", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["sharing_mode_id"], name: "index_topic_sharing_prompts_on_sharing_mode_id"
    t.index ["status"], name: "index_topic_sharing_prompts_on_status"
    t.index ["topic_id", "sharing_mode_id"], name: "index_topic_sharing_prompts_on_topic_id_and_sharing_mode_id", unique: true
    t.index ["topic_id"], name: "index_topic_sharing_prompts_on_topic_id"
  end

  create_table "topic_tags", force: :cascade do |t|
    t.bigint "topic_id", null: false
    t.bigint "tag_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["tag_id"], name: "index_topic_tags_on_tag_id"
    t.index ["topic_id", "tag_id"], name: "index_topic_tags_on_topic_id_and_tag_id", unique: true
    t.index ["topic_id"], name: "index_topic_tags_on_topic_id"
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
    t.string "difficulty"
    t.index ["difficulty"], name: "index_topics_on_difficulty"
    t.index ["topic_category_id"], name: "index_topics_on_topic_category_id"
    t.index ["topic_set_id"], name: "index_topics_on_topic_set_id"
  end

  create_table "treasurer_reports", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "created_by_id"
    t.date "period_on", null: false
    t.bigint "opening_cents", default: 0, null: false
    t.bigint "reserve_cents", default: 0, null: false
    t.jsonb "lines", default: [], null: false
    t.jsonb "splits", default: [], null: false
    t.text "notes"
    t.string "status", default: "draft", null: false
    t.string "visibility", default: "members", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_treasurer_reports_on_created_by_id"
    t.index ["group_id", "period_on"], name: "index_treasurer_reports_on_group_id_and_period_on", unique: true
    t.index ["group_id"], name: "index_treasurer_reports_on_group_id"
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
    t.string "visibility", default: "private", null: false
    t.index ["chapter_id"], name: "index_user_highlights_on_chapter_id"
    t.index ["user_id", "chapter_id"], name: "index_user_highlights_on_user_id_and_chapter_id"
    t.index ["user_id", "created_at"], name: "index_user_highlights_on_user_id_and_created_at"
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
    t.string "bio"
    t.datetime "group_prompt_dismissed_at"
    t.date "sobriety_date"
    t.boolean "show_sobriety_date", default: false, null: false
    t.string "username"
    t.string "page_layout", default: "main_side", null: false
    t.jsonb "page_blocks"
    t.string "default_highlight_visibility", default: "private", null: false
    t.string "default_note_visibility", default: "private", null: false
    t.boolean "host_reminders", default: false, null: false
    t.integer "host_reminder_hours", default: 24, null: false
    t.boolean "host_reminder_email", default: true, null: false
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["share_token"], name: "index_users_on_share_token", unique: true
    t.index ["username"], name: "index_users_on_username", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "agenda_items", "business_meetings", on_delete: :cascade
  add_foreign_key "agenda_items", "motions", on_delete: :nullify
  add_foreign_key "agenda_items", "users", column: "submitted_by_id", on_delete: :nullify
  add_foreign_key "business_meetings", "events", on_delete: :nullify
  add_foreign_key "business_meetings", "groups", on_delete: :cascade
  add_foreign_key "business_meetings", "meetings", on_delete: :nullify
  add_foreign_key "business_meetings", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "chapters", "books"
  add_foreign_key "contact_requests", "users", column: "handled_by_id", on_delete: :nullify
  add_foreign_key "contact_requests", "users", on_delete: :nullify
  add_foreign_key "court_verifications", "groups"
  add_foreign_key "court_verifications", "meetings", on_delete: :nullify
  add_foreign_key "event_collaborators", "events"
  add_foreign_key "event_collaborators", "users"
  add_foreign_key "event_collaborators", "users", column: "added_by_id", on_delete: :nullify
  add_foreign_key "event_rsvps", "events"
  add_foreign_key "event_rsvps", "users"
  add_foreign_key "event_updates", "events"
  add_foreign_key "event_updates", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "events", "groups"
  add_foreign_key "events", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "follows", "users", column: "followed_id"
  add_foreign_key "follows", "users", column: "follower_id"
  add_foreign_key "group_books", "books"
  add_foreign_key "group_books", "groups"
  add_foreign_key "group_document_templates", "groups"
  add_foreign_key "group_document_versions", "group_documents", on_delete: :cascade
  add_foreign_key "group_document_versions", "users", on_delete: :nullify
  add_foreign_key "group_documents", "groups", on_delete: :cascade
  add_foreign_key "group_documents", "motions", column: "approved_by_motion_id", on_delete: :nullify
  add_foreign_key "group_documents", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "group_documents", "users", column: "updated_by_id", on_delete: :nullify
  add_foreign_key "group_memberships", "groups"
  add_foreign_key "group_memberships", "users"
  add_foreign_key "group_page_templates", "users", column: "updated_by_id"
  add_foreign_key "groups", "users", column: "created_by_id"
  add_foreign_key "host_chat_postings", "hosting_kits", on_delete: :cascade
  add_foreign_key "host_props", "hostificators"
  add_foreign_key "host_sub_requests", "meetings"
  add_foreign_key "host_sub_requests", "users", column: "filled_by_id"
  add_foreign_key "host_sub_requests", "users", column: "requested_by_id"
  add_foreign_key "host_votes", "host_props"
  add_foreign_key "host_votes", "hostificators"
  add_foreign_key "hosting_kits", "group_documents", column: "script_document_id", on_delete: :nullify
  add_foreign_key "hosting_kits", "groups"
  add_foreign_key "hosting_kits", "meetings", on_delete: :cascade
  add_foreign_key "hosting_presences", "hosting_sessions", on_delete: :cascade
  add_foreign_key "hosting_presences", "users", on_delete: :cascade
  add_foreign_key "hosting_sessions", "meetings", on_delete: :cascade
  add_foreign_key "intergroup_follows", "users"
  add_foreign_key "meeting_host_covers", "meetings", on_delete: :cascade
  add_foreign_key "meeting_host_covers", "users", on_delete: :nullify
  add_foreign_key "meeting_host_reminders", "meetings", on_delete: :cascade
  add_foreign_key "meeting_host_reminders", "users", on_delete: :cascade
  add_foreign_key "meeting_hosts", "meetings", on_delete: :cascade
  add_foreign_key "meeting_hosts", "users", on_delete: :nullify
  add_foreign_key "meetings", "groups"
  add_foreign_key "motions", "agenda_items", on_delete: :nullify
  add_foreign_key "motions", "business_meetings", on_delete: :nullify
  add_foreign_key "motions", "groups", on_delete: :cascade
  add_foreign_key "motions", "motions", column: "parent_id", on_delete: :nullify
  add_foreign_key "motions", "motions", column: "supersedes_id", on_delete: :nullify
  add_foreign_key "motions", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "note_comments", "timeline_notes", on_delete: :cascade
  add_foreign_key "note_comments", "users", on_delete: :cascade
  add_foreign_key "note_reactions", "users", on_delete: :cascade
  add_foreign_key "notifications", "users"
  add_foreign_key "options", "polls"
  add_foreign_key "pages", "books"
  add_foreign_key "quest_inventories", "quest_sessions"
  add_foreign_key "quest_log_entries", "quest_sessions"
  add_foreign_key "quest_log_entries", "topics"
  add_foreign_key "quest_sessions", "quest_players"
  add_foreign_key "quest_sessions", "topic_sets"
  add_foreign_key "quest_stories", "quest_sessions"
  add_foreign_key "reading_tags", "readings"
  add_foreign_key "reading_tags", "tags"
  add_foreign_key "readings", "groups"
  add_foreign_key "readings", "users"
  add_foreign_key "schedule_poll_ballots", "schedule_polls"
  add_foreign_key "schedule_poll_ballots", "users"
  add_foreign_key "schedule_poll_members", "schedule_polls"
  add_foreign_key "schedule_poll_members", "users"
  add_foreign_key "schedule_polls", "events"
  add_foreign_key "schedule_polls", "users"
  add_foreign_key "service_positions", "groups", on_delete: :cascade
  add_foreign_key "service_terms", "service_positions", on_delete: :cascade
  add_foreign_key "service_terms", "users", on_delete: :nullify
  add_foreign_key "site_notices", "users", on_delete: :nullify
  add_foreign_key "text_report_comments", "text_reports"
  add_foreign_key "text_report_comments", "users"
  add_foreign_key "text_reports", "chapters"
  add_foreign_key "text_reports", "users"
  add_foreign_key "text_reports", "users", column: "resolved_by_id"
  add_foreign_key "timeline_note_shares", "groups"
  add_foreign_key "timeline_note_shares", "timeline_notes"
  add_foreign_key "timeline_notes", "timeline_notes", column: "repost_of_id", on_delete: :cascade
  add_foreign_key "timeline_notes", "users"
  add_foreign_key "topic_sharing_prompts", "sharing_modes"
  add_foreign_key "topic_sharing_prompts", "topics"
  add_foreign_key "topic_tags", "tags"
  add_foreign_key "topic_tags", "topics"
  add_foreign_key "topics", "topic_categories"
  add_foreign_key "topics", "topic_sets"
  add_foreign_key "treasurer_reports", "groups", on_delete: :cascade
  add_foreign_key "treasurer_reports", "users", column: "created_by_id", on_delete: :nullify
  add_foreign_key "user_active_groups", "groups"
  add_foreign_key "user_active_groups", "users"
  add_foreign_key "user_highlights", "chapters"
  add_foreign_key "user_highlights", "users"
end
