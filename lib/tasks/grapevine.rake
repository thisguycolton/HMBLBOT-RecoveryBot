require "csv"

namespace :grapevine do
  # Links readings taken from AA Grapevine to their stories on Grapevine's public site (GrapevineSourceLinker).
  #
  #   bin/rails grapevine:link_sources DRY_RUN=1   # show what it would do, change nothing
  #   bin/rails grapevine:link_sources             # save the links
  #   bin/rails grapevine:link_sources REDO=1      # also retry readings that only got a search link
  #   bin/rails grapevine:link_sources IDS=162,163 # just these readings (e.g. Grapevine ones whose source doesn't say so)
  #
  # It reads only the public search page, about one request every 5 seconds (Grapevine's
  # robots.txt), so ~200 readings take around 15 minutes. A report goes to tmp/grapevine_links.csv
  # and the unmatched titles are listed at the end: those get a Grapevine search link, and a
  # better link can be pasted into the reading's Source link field by hand.
  desc "Fill in Grapevine source links for readings from AA Grapevine (DRY_RUN=1 to preview, REDO=1 to retry search links)"
  task link_sources: :environment do
    dry_run = ENV["DRY_RUN"].present?
    readings = GrapevineSourceLinker.scope(redo_search_links: ENV["REDO"].present?, ids: ENV["IDS"].to_s.split(",").map(&:to_i).select(&:positive?))
    puts "#{readings.count} Grapevine readings to link#{" (dry run: nothing is saved)" if dry_run}"

    results = GrapevineSourceLinker.new(dry_run: dry_run).run(readings)

    path = Rails.root.join("tmp/grapevine_links.csv")
    CSV.open(path, "w") do |csv|
      csv << %w[id title source status url note]
      results.each { |r| csv << [r.reading.id, r.reading.title, r.reading.source, r.status, r.url, r.note] }
    end

    counts = results.group_by(&:status).transform_values(&:size)
    puts "\n#{counts.map { |status, n| "#{n} #{status}" }.join(", ")}. Report: #{path}"
    unmatched = results.reject { |r| r.status == :matched }
    if unmatched.any?
      puts "\nNot matched to a single story (linked to a Grapevine search instead):"
      unmatched.each { |r| puts "  ##{r.reading.id} #{r.reading.title} | #{r.reading.source} (#{r.note})" }
    end
  end

  # Saves the links in db/data/grapevine_links.csv: every Grapevine reading on the site as of
  # 2026-11-20, matched by hand-checked search of Grapevine's public site (title and byline).
  # A row is used only when the reading still has that id and title, and has no link yet
  # (FORCE=1 replaces links already there). DRY_RUN=1 shows what it would do.
  desc "Save the checked Grapevine links in db/data/grapevine_links.csv (DRY_RUN=1 to preview, FORCE=1 to replace links)"
  task apply_links: :environment do
    dry_run = ENV["DRY_RUN"].present?
    counts = Hash.new(0)
    CSV.foreach(Rails.root.join("db/data/grapevine_links.csv"), headers: true) do |row|
      reading = Reading.find_by(id: row["id"])
      status =
        if reading.nil? then :missing
        elsif reading.title.to_s.squish != row["title"].to_s.squish then :renamed
        elsif reading.source_url.present? && ENV["FORCE"].blank? then :has_link
        else
          reading.update_column(:source_url, row["source_url"]) unless dry_run
          row["status"] == "search" ? :search_link : :linked
        end
      counts[status] += 1
      puts "#{status.to_s.ljust(11)} ##{row['id']} #{row['title']}#{" (#{row['note']})" if row['note'].present?}"
    end
    puts "\n#{counts.map { |status, n| "#{n} #{status}" }.join(", ")}#{" (dry run: nothing saved)" if dry_run}"
  end
end
