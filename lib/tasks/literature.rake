# lib/tasks/literature.rake
namespace :literature do
  desc "Import JSON chapters into existing Book by slug"
  task import: :environment do
    dir       = ENV["path"] || raise("usage: bin/rails literature:import path=/abs/path/out/bigbook-4e book_slug=the-big-book-of-alcoholics-anonymous")
    book_slug = ENV["book_slug"] || ENV["slug"] || raise("provide book_slug=<your-book-slug>")

    LiteratureImporter.import!(book_slug: book_slug, dir: dir)
    puts "Imported chapters for book=#{book_slug} from #{dir}"
  end
end
