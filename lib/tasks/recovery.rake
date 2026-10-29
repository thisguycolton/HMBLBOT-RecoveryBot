namespace :recovery do
  desc "Send the gratitude and 10th step reminders that are due (the server also does this every 5 minutes)"
  task remind: :environment do
    RecoveryReminders.send_due!
  end
end
