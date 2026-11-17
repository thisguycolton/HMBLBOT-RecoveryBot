# A card on Site Admin > Task board (internally SCRUMBLBOT): something the site admins need to
# do. Any site admin can grab one ("I'll take it"), give it to another admin, or give it to all
# of them (for_all_admins: it shows in every admin's Today until one takes it). Moving it into
# the Done column finishes it, and moving it out again reopens it.
#
# "Urgent" (the admin Dashboard's "Tasks that need you", the sidebar count, the dot in Today)
# means not done and flagged High, or due within URGENT_DAYS, or overdue.
#
# Each change below writes an AdminTaskActivity, tells whoever should know (AdminTaskNotices),
# and the open boards hear about it (AdminTasksChannel) and fetch it again.
class AdminTask < ApplicationRecord
  PRIORITIES = %w[normal high].freeze
  URGENT_DAYS = 3
  ARCHIVE_AFTER = 30.days
  ZONE = CourtVerification::TIME_ZONE
  CHECKLIST_MAX = 50
  # The kanban tags a task can carry, shown as colored pills (labels and colors in tasks/lib.js)
  TAGS = %w[bug feature improvement content design research support blocked].freeze

  moderates_language :title, :notes, :checklist

  belongs_to :column, class_name: "AdminTaskColumn", foreign_key: :admin_task_column_id
  belongs_to :creator, class_name: "User", optional: true
  belongs_to :assignee, class_name: "User", optional: true
  belongs_to :completed_by, class_name: "User", optional: true
  has_many :activities, -> { order(:created_at, :id) }, class_name: "AdminTaskActivity", dependent: :delete_all

  before_validation :tidy
  validates :title, presence: true, length: { maximum: 200 }
  validates :notes, length: { maximum: 10_000 }
  validates :priority, inclusion: { in: PRIORITIES }
  validate :link_is_a_path
  validate :assignee_is_a_site_admin, if: :will_save_change_to_assignee_id?

  after_commit { AdminTasksChannel.changed }

  scope :visible, -> { where(archived_at: nil) }
  scope :open, -> { visible.where(completed_at: nil) }
  scope :urgent, ->(today = AdminTask.today) {
    open.where("admin_tasks.priority = 'high' OR (admin_tasks.due_on IS NOT NULL AND admin_tasks.due_on <= ?)", today + URGENT_DAYS)
  }

  def self.today = Time.current.in_time_zone(ZONE).to_date

  # What the Dashboard and the sidebar count show this admin: urgent tasks that are theirs or
  # nobody's yet, and anyone's that are overdue
  def self.urgent_for(user, today = self.today)
    urgent(today).where("admin_tasks.assignee_id IS NULL OR admin_tasks.assignee_id = ? OR admin_tasks.due_on < ?", user.id, today)
  end

  # The Today panel's "Your admin tasks": theirs, and those given to all admins nobody took yet
  def self.today_for(user)
    open.where("admin_tasks.assignee_id = ? OR (admin_tasks.assignee_id IS NULL AND admin_tasks.for_all_admins)", user.id)
  end

  # Most pressing first: overdue, then High, then by due date, then oldest
  def self.by_urgency(tasks, today = self.today)
    tasks.sort_by { |t| [t.overdue?(today) ? 0 : 1, t.high? ? 0 : 1, t.due_on || Date.new(9999), t.created_at] }
  end

  # Finished tasks fold away after a while (they're still in the database)
  def self.archive_old!
    visible.where(completed_at: ...ARCHIVE_AFTER.ago).update_all(archived_at: Time.current, updated_at: Time.current)
  end

  def done? = completed_at.present?
  def high? = priority == "high"
  def overdue?(today = AdminTask.today) = !done? && due_on.present? && due_on < today
  def due_soon?(today = AdminTask.today) = !done? && due_on.present? && due_on >= today && due_on <= today + URGENT_DAYS
  def urgent?(today = AdminTask.today) = !done? && archived_at.nil? && (high? || overdue?(today) || due_soon?(today))

  # The urgency badge: "overdue", "due_soon" or nil
  def due_state(today = AdminTask.today)
    return "overdue" if overdue?(today)
    "due_soon" if due_soon?(today)
  end

  def record!(user, kind, body: nil, data: {})
    activities.create!(user: user, kind: kind, body: body, data: data)
  end

  # Put it at `index` (0 = top) in `target`, closing the gap where it was. Moving into the Done
  # column finishes it; moving out of it reopens it.
  def move_to!(target, index, by:)
    from = column
    transaction do
      place!(target, index)
      if from.id != target.id
        record!(by, "moved", data: { from: from.name, to: target.name })
        if target.finished? && !done?
          finish!(by)
        elsif from.finished? && !target.finished? && done?
          unfinish!(by)
        end
      end
    end
    AdminTaskNotices.done(self, by) if target.finished? && from.id != target.id
    self
  end

  # "I'll take it": theirs now, and out of a starting column into the first one being worked on
  def take!(by)
    transaction do
      update!(assignee: by)
      record!(by, "took")
      place!(AdminTaskColumn.first_doing, 0) if column.start? && AdminTaskColumn.first_doing
    end
    self
  end

  # Give it back: nobody's (or all admins' again), and back to the first starting column
  def let_go!(by)
    transaction do
      update!(assignee: nil)
      record!(by, "let_go")
      place!(AdminTaskColumn.first_start, 0) if !column.finished? && !column.start?
    end
    self
  end

  # Give it to a site admin, or to nobody in particular; `all` puts it in every admin's Today
  def give!(user, all:, by:)
    before = [assignee_id, for_all_admins]
    transaction do
      update!(assignee: user, for_all_admins: all)
      next if before == [assignee_id, for_all_admins]

      record!(by, "gave", data: { to: user&.display_name, all: all })
    end
    AdminTaskNotices.assigned(self, by) if before != [assignee_id, for_all_admins]
    self
  end

  def complete!(by)
    return self if done?

    transaction do
      finish!(by)
      place!(AdminTaskColumn.finished, 0)
    end
    AdminTaskNotices.done(self, by)
    self
  end

  def reopen!(by)
    return self unless done?

    transaction do
      unfinish!(by)
      place!((assignee_id ? AdminTaskColumn.first_doing : nil) || AdminTaskColumn.first_start, 0)
    end
    self
  end

  def checklist_counts
    items = Array(checklist)
    { done: items.count { |i| i["done"] }, total: items.size }
  end

  def as_api_json(comments: 0, full: false)
    today = AdminTask.today
    json = {
      id: id, column_id: admin_task_column_id, position: position, title: title, priority: priority,
      due_on: due_on&.iso8601, due_state: due_state(today), urgent: urgent?(today), link_path: link_path,
      assignee: assignee&.as_person_json, for_all_admins: for_all_admins, creator: creator&.as_person_json,
      completed_at: completed_at&.iso8601, completed_by: completed_by&.as_person_json,
      checklist_counts: checklist_counts, comments: comments, tags: Array(tags), created_at: created_at.iso8601,
    }
    return json unless full

    json.merge(notes: notes.to_s, checklist: Array(checklist),
               activities: activities.includes(:user).map(&:as_api_json))
  end

  private

  def finish!(by)
    update!(completed_at: Time.current, completed_by: by)
    record!(by, "done")
  end

  def unfinish!(by)
    update!(completed_at: nil, completed_by: nil)
    record!(by, "reopened")
  end

  # Renumbers the column it leaves and the one it lands in (1, 2, 3...)
  def place!(target, index)
    old_id = admin_task_column_id
    siblings = AdminTask.visible.where(admin_task_column_id: target.id).where.not(id: id).order(:position, :id).to_a
    index = index.to_i.clamp(0, siblings.size)
    siblings.insert(index, self)
    update_columns(admin_task_column_id: target.id, updated_at: Time.current)
    self.column = target
    siblings.each_with_index do |task, i|
      task.update_columns(position: i + 1) unless task.position == i + 1 && task.id != id
    end
    self.position = index + 1
    renumber(old_id) if old_id != target.id
  end

  def renumber(column_id)
    AdminTask.visible.where(admin_task_column_id: column_id).order(:position, :id).each_with_index do |task, i|
      task.update_columns(position: i + 1) unless task.position == i + 1
    end
  end

  def tidy
    self.title = title.to_s.squish
    self.priority = "normal" if priority.blank?
    self.link_path = link_path.to_s.strip.presence
    self.tags = TAGS & Array(tags).map { |t| t.to_s.downcase.strip }
    self.checklist = Array(checklist).first(CHECKLIST_MAX).filter_map do |item|
      item = item.to_h.stringify_keys
      text = item["text"].to_s.squish.first(200)
      next if text.empty?

      { "id" => item["id"].to_s.presence&.first(40) || SecureRandom.hex(4), "text" => text, "done" => ActiveModel::Type::Boolean.new.cast(item["done"]) || false }
    end
  end

  # Only a path on this site ("/groups?status=pending"), never another site
  def link_is_a_path
    return if link_path.blank?

    errors.add(:link_path, "must be a page on this site, starting with /") unless link_path.start_with?("/") && !link_path.start_with?("//") && link_path.length <= 500 && !link_path.match?(/\s/)
  end

  def assignee_is_a_site_admin
    errors.add(:assignee, "must be a site admin") if assignee && !assignee.suite_admin?
  end
end
