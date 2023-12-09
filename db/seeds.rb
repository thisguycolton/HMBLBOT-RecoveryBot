# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Examples:
#
#   movies = Movie.create([{ name: "Star Wars" }, { name: "Lord of the Rings" }])
#   Character.create(name: "Luke", movie: movies.first)
require 'csv'

csv_text = File.read(Rails.root.join('lib', 'seeds', 'Topics.csv'))
csv = CSV.parse(csv_text)
csv.each do |row|
  t = Topic.new
  t.title = row[0]
  t.save
  puts "#{t.id}, #{t.title} saved"
end