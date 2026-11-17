# Marks a fresh sign-in (the sign-in form, a confirmation link, or a remembered login coming
# back after the session ran out) so the next page shows the member their day count
# (app/views/application/_toasts.html.erb, components/DayCount.jsx). Page loads within a
# session (:fetch) don't count.
Warden::Manager.after_set_user except: :fetch do |user, auth, opts|
  next unless opts[:scope] == :user && user.respond_to?(:sobriety_date) && user.sobriety_date

  auth.raw_session[:day_count_pending] = true
end
