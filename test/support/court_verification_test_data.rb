# Records for the court verification tests. These tests skip the scaffolded fixtures (several
# don't load: users.yml has two users with the same blank email) and build what they need.
module CourtVerificationTestData
  def self.included(base)
    base.fixture_table_names = []
    base.fixture_sets = {}
    # Rails 8 draws routes lazily, and Devise's sign_in needs the mappings they create
    base.setup { Rails.application.reload_routes_unless_loaded }
  end

  def create_user(admin:, email: "#{admin ? 'admin' : 'member'}-#{SecureRandom.hex(4)}@example.com")
    User.create!(email: email, password: "password123", confirmed: true, admin: admin)
  end

  # the one admin allowed in (COURT_VERIFICATION_ADMIN_EMAILS)
  def create_court_admin
    create_user(admin: true, email: "court-admin@example.com")
  end

  # meeting_at given as Phoenix wall-clock time
  def create_verification(name:, meeting_at:, email: "respondent@example.com")
    CourtVerification.create!(respondent_name: name, respondent_email: email,
                              meeting_at: Time.find_zone!("America/Phoenix").parse(meeting_at),
                              host_name: "Host Person", signer_name: "Signer Person", topic: "Step One")
  end
end
