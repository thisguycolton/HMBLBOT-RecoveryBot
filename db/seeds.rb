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
file_path = 'topics_with_categories.csv'

valid_category_ids = TopicCategory.pluck(:id)

CSV.read(file_path, headers: true).each do |row|
  topic_category_id = row['CategoryId'].to_i

  # Check if the category_id exists in the topic_categories table
  if valid_category_ids.include?(topic_category_id)
    # Proceed with upsert
    Topic.upsert(
      {
        id: row['ID'].to_i,
        title: row['Title'],
        searchable_number: row['Searchable Number'],
        subtitle: row['Subtitle'],
        topic_category_id: topic_category_id
      },
      unique_by: :id
    )
  else
    # Handle invalid category_id
    # Option 1: Skip the row and log a message
    puts "Skipping topic with ID #{row['ID']}: Invalid CategoryId '#{topic_category_id}'"
    # Option 2: Set a default category
    # default_category_id = 1 # Ensure this ID exists in topic_categories
    # puts "Setting topic with ID #{row['ID']} to default category ID #{default_category_id}"
    # Topic.upsert(
    #   {
    #     id: row['ID'].to_i,
    #     title: row['Title'],
    #     searchable_number: row['Searchable Number'],
    #     subtitle: row['Subtitle'],
    #     category_id: default_category_id
    #   },
    #   unique_by: :id
    # )
    # Option 3: Raise an error
    # raise "Invalid CategoryId '#{category_id}' for topic with ID #{row['ID']}"
  end
end
