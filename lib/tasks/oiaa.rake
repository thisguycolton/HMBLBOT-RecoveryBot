namespace :oiaa do
  desc "Fetch OIAA's meeting directory now and refresh meetings linked to it"
  task sync: :environment do
    puts "Feed: #{OiaaFeed.feed_url}"
    puts "#{OiaaFeed.sync!} OIAA meetings cached"
  end
end
