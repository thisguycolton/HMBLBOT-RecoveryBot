namespace :meeting_guide do
  desc "Fetch the Meeting Guide feed now and refresh meetings linked to it"
  task sync: :environment do
    puts "Feed: #{OiaaFeed.feed_url}"
    puts "#{OiaaFeed.sync!} Meeting Guide meetings cached"
  end
end

namespace :oiaa do
  task sync: "meeting_guide:sync"
end
