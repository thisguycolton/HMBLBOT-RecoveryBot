# A note on a member's own timeline (/groups/timeline). Only its author sees it until they
# share it to groups they're in; then that group's members see it in the group page's
# Timeline block. A group's admins can take a note off their group's timeline.
class TimelineNote < ApplicationRecord
  BODY_MAX = 2000

  belongs_to :user
  has_many :shares, class_name: "TimelineNoteShare", dependent: :destroy
  has_many :groups, through: :shares

  validates :body, presence: true, length: { maximum: BODY_MAX }

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }

  # Shares it to these groups, only the ones its author is in, and stops sharing it to the rest
  def share_to!(groups)
    allowed = groups.select { |g| g.member?(user) }
    shares.where.not(group_id: allowed.map(&:id)).destroy_all
    allowed.each { |g| shares.find_or_create_by!(group: g) }
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  def edited? = updated_at - created_at > 1.minute

  # With `group`, as that group's timeline shows it (can_remove: its author, or the
  # group's admins); without, as its author sees it on their own timeline
  def as_api_json(viewer:, group: nil)
    json = { id: id, body: body, created_at: created_at.iso8601, edited: edited?, author: user.as_member_json, mine: viewer&.id == user_id }
    if group
      json[:can_remove] = json[:mine] || group.manageable_by?(viewer)
    else
      json[:groups] = groups.map { |g| { slug: g.slug, title: g.title } }
    end
    json
  end
end
