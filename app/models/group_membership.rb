# Someone in a group. Admins run the group (its page, meetings, literature, members and
# court verifications); members see it. A "requested" membership is a join request
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

  def active? = status == "active"
  def admin? = role == "admin"
end
