# Logging out (either Log out link) leaves a short-lived forget_push cookie; the next page
# (lib/push.js forgetPushAfterSignOut) drops this browser's push subscription, so it stops
# getting that account's notifications. A session that just ran out doesn't do this: the
# device keeps its notifications until the member logs out or turns them off.
Warden::Manager.before_logout do |_user, auth, opts|
  next unless opts[:scope] == :user

  ActionDispatch::Request.new(auth.env).cookie_jar[:forget_push] = { value: "1", expires: 1.day.from_now, httponly: false, same_site: :lax }
end
