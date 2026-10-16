namespace :aa_intergroup do
  desc "Fetch AA Intergroup's meeting feed now and refresh meetings linked to it"
  task sync: :environment do
    puts "Feed: #{OiaaFeed.feed_url}"
    puts "#{OiaaFeed.sync!} AA Intergroup meetings cached"
  end
end

namespace :oiaa do
  task sync: "aa_intergroup:sync"
end
