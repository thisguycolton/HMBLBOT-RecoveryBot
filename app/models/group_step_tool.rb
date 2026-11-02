# A worksheet a group publishes for its members (a step study, say): a copy of the worksheet
# only, never anyone's answers. Hosts and admins publish them from a worksheet of their own;
# members see them on Steps and start their own copy. Free for every group.
class GroupStepTool < ApplicationRecord
  moderates_language :name, :summary, :definition

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true

  validates :name, presence: true, length: { maximum: 200 }
  validates :summary, length: { maximum: 500 }
  validates :step, inclusion: { in: StepTool::STEPS }
  validate { errors.add(:definition, "is missing") if definition.blank? }

  before_validation { self.summary = summary.to_s.strip.presence }

  def self.publishable_by?(group, user) = group.can_host?(user) || group.manageable_by?(user)
  def removable_by?(user) = created_by_id == user.id || group.manageable_by?(user)

  def as_api_json(viewer)
    { id: id, name: name, step: step, summary: summary, group: { slug: group.slug, title: group.title },
      by: created_by&.display_name, created_at: created_at.iso8601, can_remove: removable_by?(viewer) }
  end
end
