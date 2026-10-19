require "csv"

namespace :minutes do
  # Bring a group's old minutes in from a folder of Word files in year folders (MinutesImport).
  #   bin/rails "minutes:import[the-acid-test,/path/to/Acid Test Meeting Minutes]"
  # DRY_RUN=1 saves nothing; REPORT=file.csv writes every motion it found, to check first.
  desc "Import business meetings and motions from a folder of old minutes"
  task :import, %i[slug folder] => :environment do |_, args|
    group = Group.find_by!(slug: args[:slug])
    dry = ENV["DRY_RUN"].present?
    rows = MinutesImport.new(group, args[:folder], user: group.admins.first).run(dry_run: dry)

    rows.each do |r|
      puts r[:skipped] ? "skip  #{r[:file]} (#{r[:skipped]})" : "#{r[:held_on]}  #{r[:file]}: #{r[:motions].size} motions"
    end
    kept = rows.reject { |r| r[:skipped] }
    puts "#{dry ? "Would bring in" : "Brought in"} #{kept.size} meetings and #{kept.sum { |r| r[:motions].size }} motions; skipped #{rows.size - kept.size} files."

    if ENV["REPORT"].present?
      CSV.open(ENV["REPORT"], "w") do |csv|
        csv << %w[meeting file status title moved_by seconded_by category text]
        kept.each { |r| r[:motions].each { |m| csv << [r[:held_on], r[:file], m[:status], m[:title], m[:moved_by_name], m[:seconded_by_name], m[:category], m[:text]] } }
      end
      puts "Wrote #{ENV["REPORT"]}"
    end
  end
end
