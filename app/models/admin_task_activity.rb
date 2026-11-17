# What happened on a Site Admin task (SCRUMBLBOT), oldest first in the task's detail: who made
# it, took it, gave it away, moved or finished it, and the admins' comments.
class AdminTaskActivity < ApplicationRecord
  KINDS = %w[comment created took let_go gave moved done reopened edited].freeze

  moderates_language :body
  belongs_to :admin_task
  belongs_to :user, optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :body, presence: true, length: { maximum: 5000 }, if: -> { kind == "comment" }

  def as_api_json
    { id: id, kind: kind, body: body, data: data, user: user&.as_person_json, created_at: created_at.iso8601 }
  end
end
