# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Examples:
#
#   movies = Movie.create([{ name: "Star Wars" }, { name: "Lord of the Rings" }])
#   Character.create(name: "Luke", movie: movies.first)
require 'csv'

# csv_text = File.read(Rails.root.join('lib', 'seeds', 'TopicCats.csv'), row_sep: "|")
# csv = CSV.parse(csv_text, col_sep: "|")
# csv.each.with_index(1) do |row, index|
#   t = Topic.new
#   t.title = row[1]
#   t.searchable_number = index
#   t.save
#   puts "#{t.id}, #{t.title} saved"
# end
# csv.each.with_index(1) do |row, index|
#   t = TopicCategory.new
#   t.title = row[1]
#   t.cat = row[0]
#   t.save
#   puts "#{t.cat}, #{t.title} saved"
# end
# User.create!(email: 'admin@example.com', password: 'password', password_confirmation: 'password') if Rails.env.development?
# file_path = 'topics_with_categories.csv'

# valid_category_ids = TopicCategory.pluck(:id)

# CSV.read(file_path, headers: true).each do |row|
#   topic_category_id = row['CategoryId'].to_i

#   # Check if the category_id exists in the topic_categories table
#   if valid_category_ids.include?(topic_category_id)
#     # Proceed with upsert
#     Topic.upsert(
#       {
#         id: row['ID'].to_i,
#         title: row['Title'],
#         searchable_number: row['Searchable Number'],
#         subtitle: row['Subtitle'],
#         topic_category_id: topic_category_id
#       },
#       unique_by: :id
#     )
#   else
#     # Handle invalid category_id
#     # Option 1: Skip the row and log a message
#     puts "Skipping topic with ID #{row['ID']}: Invalid CategoryId '#{topic_category_id}'"
#     # Option 2: Set a default category
#     # default_category_id = 1 # Ensure this ID exists in topic_categories
#     # puts "Setting topic with ID #{row['ID']} to default category ID #{default_category_id}"
#     # Topic.upsert(
#     #   {
#     #     id: row['ID'].to_i,
#     #     title: row['Title'],
#     #     searchable_number: row['Searchable Number'],
#     #     subtitle: row['Subtitle'],
#     #     category_id: default_category_id
#     #   },
#     #   unique_by: :id
#     # )
#     # Option 3: Raise an error
#     # raise "Invalid CategoryId '#{category_id}' for topic with ID #{row['ID']}"
#   end
#


# categories = [
#   { cat: 'CAT_001', title: 'General Recovery Principles', icon: 'icon-default' },
#   { cat: 'CAT_002', title: 'Gratitude', icon: 'icon-gratitude' },
#   { cat: 'CAT_003', title: '12 Steps', icon: 'icon-steps' },
#   { cat: 'CAT_004', title: 'Fellowship & Service', icon: 'icon-fellowship' },
#   { cat: 'CAT_005', title: 'Slogans & Mantras', icon: 'icon-slogans' },
#   { cat: 'CAT_006', title: 'Mindset Shifts', icon: 'icon-mindset' },
#   { cat: 'CAT_007', title: 'Special Occasions', icon: 'icon-occasions' },
#   { cat: 'CAT_008', title: 'Serenity Prayer', icon: 'icon-prayer' }
# ]

# categories.each do |category|
#   TopicCategory.find_or_create_by!(cat: category[:cat]) do |tc|
#     tc.title = category[:title]
#     tc.icon = category[:icon]
#   end
# end

# puts "Created #{TopicCategory.count} categories"

# Load and parse the CSV
# require "csv"

# csv_path = Rails.root.join("topics_newcomer_plus_core_aa_reindexed.csv")
# TOPIC_SET_ID = 4

# topic_set = TopicSet.find(TOPIC_SET_ID) # will raise if not found (good)
# puts "Seeding topics into Topic Set ##{topic_set.id} (#{topic_set.try(:name) || 'unnamed'})"

# created = 0
# updated = 0

# CSV.foreach(
#   csv_path,
#   headers: true,
#   encoding: "bom|utf-8",
#   liberal_parsing: true
# ) do |row|
#   title       = row["Title"]&.strip
#   subtitle    = row["Subtitle"]&.strip.presence
#   snum        = row["Searchable Number"].to_i
#   raw_cat     = row["CategoryId"].to_s.strip
#   # "8.0" -> 8; allow blank
#   cat_id      = raw_cat.empty? ? nil : raw_cat.to_f.to_i
#   cat_id      = nil unless TopicCategory.exists?(cat_id)

#   next if title.blank? || snum.zero?

#   topic = Topic.where(topic_set_id: TOPIC_SET_ID, searchable_number: snum).first_or_initialize

#   was_new = topic.new_record?
#   topic.title              = title
#   topic.subtitle           = subtitle
#   topic.topic_set_id       = TOPIC_SET_ID
#   topic.searchable_number  = snum
#   topic.topic_category_id  = cat_id # may be nil, that’s OK if the column allows null

#   topic.save!

#   was_new ? created += 1 : updated += 1
# end

# puts "✅ Topics upserted into set ##{TOPIC_SET_ID} — created: #{created}, updated: #{updated}"
# # end
require "csv"

csv_path = Rails.root.join("OIAA_List.csv")
TOPIC_SET_ID = 2

topic_set = TopicSet.find(TOPIC_SET_ID) # will raise if not found (good)
puts "Seeding topics into Topic Set ##{topic_set.id} (#{topic_set.try(:name) || 'unnamed'})"

created = 0
updated = 0

CSV.foreach(
  csv_path,
  headers: false,           # <-- no headers
  col_sep: "|",             # <-- pipe separated
  encoding: "bom|utf-8",
  liberal_parsing: true
) do |row|
  # Expected columns:
  # 0: Searchable Number
  # 1: Title
  # 2: Subtitle (optional/blank)
  # 3: Category code, e.g. "CAT_001"

  snum        = row[0].to_i
  title       = row[1].to_s.strip
  subtitle    = row[2].to_s.strip.presence
  raw_cat     = row[3].to_s.strip.presence # "CAT_001", etc.

  next if title.blank? || snum.zero?

  # 🔎 Adjust this lookup to match your TopicCategory schema.
  # Example if you have a `code` column on TopicCategory:
  cat_id = nil
  if raw_cat.present?
    cat = TopicCategory.find_by(cat: raw_cat)
    cat_id = cat.id if cat
  end

  topic = Topic.where(topic_set_id: TOPIC_SET_ID, searchable_number: snum).first_or_initialize
  was_new = topic.new_record?

  topic.title             = title
  topic.subtitle          = subtitle
  topic.topic_set_id      = TOPIC_SET_ID
  topic.searchable_number = snum
  topic.topic_category_id = cat_id # may be nil

  topic.save!

  was_new ? created += 1 : updated += 1
end

puts "✅ Topics upserted into set ##{TOPIC_SET_ID} — created: #{created}, updated: #{updated}"
