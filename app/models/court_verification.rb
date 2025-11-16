class CourtVerification < ApplicationRecord
  validates :respondent_name, :respondent_email, :meeting_at, :host_name, presence: true
  validates :respondent_email, format: { with: URI::MailTo::EMAIL_REGEXP }
end
