# Local meeting lists (MeetingDirectory) from the command line. The admin suite's Meeting
# lists page does the same with a preview you can tick through.
#
#   bin/rails "meeting_lists:preview[phx,https://example.org/feed.json]"   what an import would do
#   bin/rails "meeting_lists:import[phx,path/to/meetings.csv]"            import new and changed
#                                                                          meetings (not possible
#                                                                          duplicates; hides nothing)
# The source is a feed link or a file path; leave it out to use the list's feed link.
namespace :meeting_lists do
  def meeting_list_import(args)
    directory = MeetingDirectory.find_by!(key: args[:key])
    source = args[:source].presence || directory.feed_url or abort "#{directory.name} has no feed link; give a link or a file."
    source.match?(%r{\Ahttps?://}i) ? MeetingListImport.new(directory, url: source) : MeetingListImport.new(directory, text: File.read(source))
  end

  desc "Show what importing a meeting list would do"
  task :preview, %i[key source] => :environment do |_, args|
    preview = meeting_list_import(args).preview
    puts preview[:counts].map { |k, v| "#{k}: #{v}" }.join(", ")
    preview[:rows].each do |row|
      next if row[:status] == "same"

      dupes = row[:duplicates].to_a.map { |d| "maybe #{d[:name]} (#{d[:source]})" }.join("; ")
      puts [row[:status].ljust(8), row[:listing][:name], row[:listing][:schedule], row[:reason], row[:changes].to_a.join(" "), dupes].compact_blank.join(" | ")
    end
  end

  desc "Import a meeting list's new and changed meetings"
  task :import, %i[key source] => :environment do |_, args|
    import = meeting_list_import(args)
    keys = import.preview[:rows].select { |r| r[:selected] }.map { |r| r[:key] }
    puts import.apply!(keys: keys).map { |k, v| "#{k}: #{v}" }.join(", ")
  end
end
