# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Examples:
#
#   movies = Movie.create([{ name: "Star Wars" }, { name: "Lord of the Rings" }])
#   Character.create(name: "Luke", movie: movies.first)
require 'csv'

csv_text = File.read(Rails.root.join('lib', 'seeds', 'TopicCats.csv'), row_sep: "|")
csv = CSV.parse(csv_text, col_sep: "|")
# csv.each.with_index(1) do |row, index|
#   t = Topic.new
#   t.title = row[1]
#   t.searchable_number = index
#   t.save
#   puts "#{t.id}, #{t.title} saved"
# end
csv.each.with_index(1) do |row, index|
  t = TopicCategory.new
  t.title = row[1]
  t.cat = row[0]
  t.save
  puts "#{t.cat}, #{t.title} saved"
end
# User.create!(email: 'admin@example.com', password: 'password', password_confirmation: 'password') if Rails.env.development?
