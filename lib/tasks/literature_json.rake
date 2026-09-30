# frozen_string_literal: true

# Copy to recoverybot: lib/tasks/literature_json.rake
#
#   bin/rails "literature_json:import[out/bigbook-4e.json]"
#   bin/rails "literature_json:import[out/bigbook-4e.json,replace]"
namespace :literature_json do
  desc "Import a litconv JSON artifact into Book/Chapter/Page (add 'replace' to re-import)"
  task :import, %i[path mode] => :environment do |_t, args|
    abort "usage: literature_json:import[path/to/file.json(,replace)]" if args[:path].blank?

    result = LiteratureJsonImporter.import!(args[:path], replace: args[:mode] == "replace")
    book = result.book
    puts "#{book.title} (#{book.work_key} #{book.edition}/#{book.language}) id=#{book.id} slug=#{book.slug}"
    puts "chapters: #{result.chapters_created} created, #{result.chapters_updated} updated, " \
         "#{result.chapters_deleted} deleted; pages: #{result.pages_created}"
    result.warnings.each { |w| warn "WARNING: #{w}" }
  rescue LiteratureJsonImporter::Error => e
    abort "import rejected: #{e.message}"
  end
end
