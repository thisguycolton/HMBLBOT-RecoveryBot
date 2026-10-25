# Someone in a group. Admins run the group (its page, meetings, literature, members and
# court verifications); members see it. A member with can_keep_records is a record keeper:
# they write its documents (Group#records_editable_by?). One with can_host can host or co-host
# its meetings (Group#can_host?). One with can_schedule_hosts is a host coordinator: for the
# whole group, or (host_slots_only) only the weekly meetings in host_meeting_ids. A "requested" membership is a join request
# waiting for a group admin.
class GroupMembership < ApplicationRecord
  ROLES = %w[admin member].freeze
  STATUSES = %w[active requested].freeze

  belongs_to :group
  belongs_to :user

  validates :role, inclusion: { in: ROLES }
  validates :status, inclusion: { in: STATUSES }
  validates :user_id, uniqueness: { scope: :group_id }

  scope :active, -> { where(status: "active") }
  scope :requested, -> { where(status: "requested") }
  scope :admins, -> { where(role: "admin") }

  # Coordinators who look after the whole group, or this meeting among their time slots
  scope :coordinating, ->(meeting) { where("NOT group_memberships.host_slots_only OR ? = ANY(group_memberships.host_meeting_ids)", meeting.id) }

  def active? = status == "active"
  def admin? = role == "admin"
  # Whether this coordinator looks after a weekly meeting (admins look after every one)
  def coordinates?(meeting) = admin? || !host_slots_only || host_meeting_ids.include?(meeting.id)
  def slot_coordinator? = !admin? && can_schedule_hosts && host_slots_only
end
