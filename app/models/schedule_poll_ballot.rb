# One voter's ranked start times in a schedule poll. Anyone can vote; a voter is known by
# their account when signed in, otherwise by a cookie, and each network (IP) gets one
# anonymous ballot per poll.
class SchedulePollBallot < ApplicationRecord
  moderates_language :voter_name
  belongs_to :schedule_poll
  belongs_to :user, optional: true

  validates :voter_token, presence: true
  validate :choices_fit

  def self.ip_digest(ip) = OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, "schedule-poll:#{ip}")

  def display_name = user&.name.presence || voter_name.presence || "Someone"

  def as_api_json
    { id: id, name: display_name, signed_in: user_id.present?, choices: choices, voted_at: updated_at.iso8601 }
  end

  private

  def choices_fit
    poll = schedule_poll or return
    list = Array(choices)
    errors.add(:base, "Pick at least one time") if list.empty?
    errors.add(:base, "Pick at most #{poll.choices_count} times") if list.size > poll.choices_count
    errors.add(:base, "Each time can only be picked once") if list.uniq.size != list.size
    # Only the times this save adds have to still be open; earlier picks stay as they were
    added = list - Array(choices_was)
    added.each do |start|
      problem = poll.start_problem(start) or next
      date, minute = SchedulePoll.parse_start(start)
      label = date ? "#{date.strftime('%a %b %-d')} at #{Time.utc(2000, 1, 1, minute / 60, minute % 60).strftime('%-l:%M %p')}" : start.to_s
      errors.add(:base, "#{label} #{problem}")
    end
  end
end
