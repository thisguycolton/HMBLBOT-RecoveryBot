# A message sent from the Contact page (/contact). Kept so admins can work through them in
# the admin suite (Contact requests), and emailed to ContactMailer::RECIPIENT as it arrives.
class ContactRequest < ApplicationRecord
  STATUSES = %w[open handled].freeze
  MAX_MESSAGE = 5_000

  belongs_to :user, optional: true
  belongs_to :handled_by, class_name: "User", optional: true

  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP, message: "needs to be an address we can reply to" }
  validates :message, presence: true, length: { maximum: MAX_MESSAGE }
  validates :name, length: { maximum: 100 }
  validates :topic, inclusion: { in: ->(_) { ContactMailer::TOPICS.keys } }
  validates :status, inclusion: { in: STATUSES }

  scope :unhandled, -> { where(status: "open") }

  def topic_label = ContactMailer::TOPICS.fetch(topic, topic)

  def handle!(by) = update!(status: "handled", handled_at: Time.current, handled_by: by)
  def reopen! = update!(status: "open", handled_at: nil, handled_by: nil)
end
