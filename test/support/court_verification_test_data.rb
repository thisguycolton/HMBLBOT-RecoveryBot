# Records for the court verification tests. These tests skip the scaffolded fixtures (several
# don't load: users.yml has two users with the same blank email) and build what they need.
module CourtVerificationTestData
  def self.included(base)
    base.fixture_table_names = []
    base.fixture_sets = {}
  end

  def create_user(admin:)
    User.create!(email: "#{admin ? 'admin' : 'member'}-#{SecureRandom.hex(4)}@example.com",
                 password: "password123", confirmed: true, admin: admin)
  end

  # meeting_at given as Phoenix wall-clock time
  def create_verification(name:, meeting_at:, email: "respondent@example.com")
    CourtVerification.create!(respondent_name: name, respondent_email: email,
                              meeting_at: Time.find_zone!("America/Phoenix").parse(meeting_at),
                              host_name: "Host Person", signer_name: "Signer Person", topic: "Step One")
  end
end
