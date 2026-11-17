# A reminder already sent to a host before one date of a meeting, so each goes out once
class MeetingHostReminder < ApplicationRecord
  belongs_to :user
  belongs_to :meeting
end
