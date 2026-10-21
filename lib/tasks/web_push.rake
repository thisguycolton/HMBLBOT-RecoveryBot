namespace :web_push do
  desc "Make a VAPID key pair for Web Push; set both in the app's environment (CapRover: App Configs > Environmental Variables)"
  task keys: :environment do
    key = WebPush.generate_key
    puts "VAPID_PUBLIC_KEY=#{key.public_key}"
    puts "VAPID_PRIVATE_KEY=#{key.private_key}"
    puts "VAPID_SUBJECT=mailto:support@hmblbot.com"
    puts
    puts "Keep the private key secret, and don't change the pair later: every device would have to turn notifications on again."
  end

  desc "Send a test push to every device of an account: bin/rails web_push:test EMAIL=you@example.com"
  task test: :environment do
    user = User.find_by!(email: ENV.fetch("EMAIL"))
    abort "VAPID keys aren't set" unless WebPushSender.configured?
    subs = user.push_subscriptions.to_a
    abort "#{user.email} hasn't turned on notifications on any device" if subs.empty?
    subs.each do |sub|
      ok = WebPushSender.send_to(sub, { title: "Test from RecoveryBot", body: "Push notifications work.", tag: "test", url: "/" })
      puts "#{sub.device_label}: #{ok ? "sent" : "failed (see the log)"}"
    end
  end
end
