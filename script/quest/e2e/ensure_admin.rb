# Part of the ACID QUEST test scripts. Makes sure the local test admin used by
# topicificator_admin.mjs exists (development database only).
abort "development only" unless Rails.env.development?
u = User.find_or_initialize_by(email: "quest-e2e-admin@example.test")
u.password = "quest-e2e-admin-pw"
u.name ||= "Quest E2E Admin"
u.admin = true
u.confirmed = true
u.confirmed_at ||= Time.current
u.save!
