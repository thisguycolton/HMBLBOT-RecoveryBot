# The day's Daily Reflection as a Facebook Page Story (DailyStory)
#   bin/rails daily_story:post         post today's if it's time and it hasn't gone (the server
#                                      checks every few minutes on its own)
#   bin/rails daily_story:post_now     post today's now, whatever the time
#   bin/rails "daily_story:clips[out]" draw today's Story clips into the folder out, to look at
namespace :daily_story do
  task post: :environment do
    record = DailyStory.post_due!
    puts record ? "#{record.status}: #{record.error || "#{record.clips} clip(s)"}" : "Not due (or not connected / turned off)."
  end

  task post_now: :environment do
    connection = FacebookPageConnection.current
    abort "Connect a Facebook Page first (Site Admin > Daily story)." unless connection.connected?
    record = DailyStory.post!(connection, on: Time.current.in_time_zone(connection.zone).to_date, by: "admin")
    abort "A story is posting already." unless record
    puts "#{record.status}: #{record.error || "#{record.clips} clip(s)"}"
  end

  task :clips, [:out] => :environment do |_, args|
    out = Pathname(args[:out].presence || "tmp/daily_story")
    FileUtils.mkdir_p(out)
    connection = FacebookPageConnection.current
    chapter = DailyStory.chapter_for(Time.current.in_time_zone(connection.zone).to_date) or abort "No Daily Reflection for today."
    Dir.mktmpdir do |dir|
      DailyStory.clips(chapter, look: connection.look, dir: dir).each do |f|
        FileUtils.cp(f, out)
        puts out.join(File.basename(f))
      end
    end
  end
end
