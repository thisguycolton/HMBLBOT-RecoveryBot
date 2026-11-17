# One voter's answers in a Poll. A voter is known by their account when signed in, otherwise by
# the hb_voter cookie (each network gets one guest ballot per poll, by hashed IP). A ballot cast
# before signing in becomes the account's.
class PollBallot < ApplicationRecord
  moderates_language :voter_name
  belongs_to :poll
  belongs_to :user, optional: true

  validates :voter_token, presence: true
  validates :voter_name, length: { maximum: 60 }
  validate :choices_fit

  after_commit -> { poll.broadcast_change }

  def self.ip_digest(ip) = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, "poll:#{ip}")

  def display_name = user&.display_name.presence || voter_name.presence || "Guest"

  def as_voter_json = { id: id, name: display_name, guest: user_id.nil? }

  private

  def choices_fit
    picked = Array(option_ids).map(&:to_i)
    self.option_ids = picked
    errors.add(:base, "Pick an answer") if picked.empty?
    errors.add(:base, poll.max_choices == 1 ? "Pick just one answer" : "Pick at most #{poll.max_choices} answers") if poll && picked.size > poll.max_choices
    errors.add(:base, "Each answer can only be picked once") if picked.uniq.size != picked.size
    errors.add(:base, "That answer isn't in this poll") if poll && (picked - poll.options.map(&:id)).any?
  end
end
