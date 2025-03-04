# lib/tasks/seed_icons.rake
namespace :icons do
  desc "Seed the database with icon data"
  task seed: :environment do
    icon_dir = Rails.root.join("app", "assets", "images", "icons")
    icon_files = Dir.glob("#{icon_dir}/*.{svg,png,jpg}") # Adjust extensions as needed

    icon_files.each do |file|
      file_name = File.basename(file)
      icon_name = file_name.gsub(/\.[^.]+\z/, "") # Remove file extension
      Icon.create!(name: icon_name, file_path: "icons/#{file_name}", category: "default")
    end

    puts "Seeded #{icon_files.size} icons."
  end
end
