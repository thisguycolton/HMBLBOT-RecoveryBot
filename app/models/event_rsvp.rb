# Someone coming to (or following) an event. People with an account RSVP as themselves;
# anyone else can leave a name and email to hear about updates. Voting in one of the
# event's schedule polls with an account follows the event ("following").
class EventRsvp < ApplicationRecord
  moderates_language :name
  STATUSES = %w[going maybe following not_going].freeze
  SUBSCRIBED = %w[going maybe following].freeze

  belongs_to :event
  belongs_to :user, optional: true

  before_validation { self.token ||= SecureRandom.alphanumeric(24) }
  before_validation { self.email = email.to_s.strip.downcase.presence }
  before_validation { self.name = name.to_s.strip.first(80).presence }

  validates :status, inclusion: { in: STATUSES }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_nil: true
  validates :email, presence: { message: "is needed so we can send you updates" }, unless: :user_id
  validates :user_id, uniqueness: { scope: :event_id }, allow_nil: true

  scope :subscribed, -> { where(status: SUBSCRIBED) }
  scope :going, -> { where(status: "going") }

  def guest? = user_id.nil?
  def display_name = user&.display_name || name.presence || email.to_s.split("@").first
  def deliver_to = user&.email || email

  def as_api_json(email: false)
    { id: id, name: display_name, status: status, guest: guest?, avatar_url: user&.avatar_url,
      email: (deliver_to if email), created_at: created_at.iso8601 }
  end
end
