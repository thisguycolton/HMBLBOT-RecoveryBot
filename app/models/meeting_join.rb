# A member clicked Join on a meeting in the half hour before it started (Api::MeetingJoinsController).
# Once that start comes, it counts toward the meeting's Meeting Maker chips (Chips.meeting_chips).
class MeetingJoin < ApplicationRecord
  WINDOW = 30.minutes

  belongs_to :user
  belongs_to :meeting

  # The start a Join click now counts for, or nil when the meeting isn't starting within WINDOW
  def self.start_for(meeting, now = Time.current)
    start = meeting.next_start(now)
    start if start && start >= now && start - now <= WINDOW
  end
end
