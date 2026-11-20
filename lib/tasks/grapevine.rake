namespace :grapevine do
  # Links readings taken from AA Grapevine to their stories on Grapevine's public site (GrapevineSourceLinker).
  #
  #   bin/rails grapevine:link_sources DRY_RUN=1   # show what it would do, change nothing
  #   bin/rails grapevine:link_sources             # save the links
  #   bin/rails grapevine:link_sources REDO=1      # also retry readings that only got a search link
  #
  # It reads only the public search page, about one request every 5 seconds (Grapevine's
  # robots.txt), so ~200 readings take around 15 minutes. A report goes to tmp/grapevine_links.csv
  # and the unmatched titles are listed at the end: those get a Grapevine search link, and a
  # better link can be pasted into the reading's Source link field by hand.
  desc "Fill in Grapevine source links for readings from AA Grapevine (DRY_RUN=1 to preview, REDO=1 to retry search links)"
  task link_sources: :environment do
    dry_run = ENV["DRY_RUN"].present?
    readings = GrapevineSourceLinker.scope(redo_search_links: ENV["REDO"].present?)
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
end
