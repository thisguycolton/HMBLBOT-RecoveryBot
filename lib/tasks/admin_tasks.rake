namespace :admin_tasks do
  desc "Send the Task board's due and overdue reminders (the server also does this hourly)"
  task remind: :environment do
    puts "#{AdminTaskReminders.send_due!} sent"
  end
end
