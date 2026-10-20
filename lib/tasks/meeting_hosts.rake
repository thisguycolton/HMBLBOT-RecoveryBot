namespace :meeting_hosts do
  desc "Remind hosts and co-hosts who asked for it before their meetings (the server also does this every 10 minutes)"
  task remind: :environment do
    HostReminders.send_due!
  end
end
