# A member's work on a step (/recovery/steps/:id), from a StepTool. It keeps its own copy of
# the worksheet (`definition`), which they can change, and their `answers` (shaped as
# StepTool describes), encrypted in the database. Only they can read it here; they can send
# it, or a part of it, to their sponsor as text (SponsorshipShare).
class StepWork < ApplicationRecord
  moderates_language :name, :answers, :definition

  ANSWERS_MAX = 400_000 # characters of JSON
  STATUSES = %w[in_progress done].freeze

  belongs_to :user
  serialize :answers, coder: JSON
  encrypts :answers

  validates :name, presence: true, length: { maximum: 200 }
  validates :step, inclusion: { in: StepTool::STEPS }
  validates :status, inclusion: { in: STATUSES }
  validate { errors.add(:answers, "is too long") if answers.to_json.size > ANSWERS_MAX }
  validate { errors.add(:definition, "is missing") if definition.blank? }
  validates :remind_at, format: { with: /\A([01]\d|2[0-3]):[0-5]\d\z/, message: "should be a time like 18:00" }, allow_nil: true

  # Its reminder (RecoveryReminders.remind_work): turning it on or moving it after today's time
  # has passed starts it tomorrow
  before_save do
    if remind_at && (will_save_change_to_remind_at? || will_save_change_to_remind_days?)
      now = Time.current.in_time_zone(user.zone)
      self.reminded_on = now.to_date if now.hour * 60 + now.min >= RecoveryReminders.minutes(remind_at)
    end
  end

  before_validation do
    self.answers = {} unless answers.is_a?(Hash)
    self.settings = (settings || {}).slice("higher_power").transform_values { |v| v.to_s.strip.first(60) }
    self.remind_at = remind_at.presence
    self.remind_days = Array(remind_days).map(&:to_i).select { |d| (0..6).cover?(d) }.uniq.sort
  end

  def self.start!(user, tool)
    user.step_works.create!(step: tool.step, tool_key: tool.key, name: tool.name, definition: tool.definition, answers: {}, status: "in_progress")
  end

  def tool = StepTool.find(tool_key)

  # Values from this member's work on `step` that carry `role` (names, my part), newest work
  # first, for a later step to pull in (StepTool `rows_from`, `suggest_from`)
  def self.pull(user, step:, role:)
    user.step_works.where(step: step).order(updated_at: :desc).flat_map { |w| w.values_for(role) }.uniq.first(500)
  end

  def values_for(role)
    Array(definition["sections"]).flat_map do |s|
      a = answers[s["id"]]
      case s["kind"]
      when "table"
        cols = Array(s["columns"]).select { |c| c["role"] == role }.map { |c| c["id"] }
        Array(a).flat_map { |row| cols.flat_map { |c| Array(row.is_a?(Hash) ? row[c] : nil) } }
      when "each"
        items = Array(s["items"]).select { |i| i["role"] == role }.map { |i| i["id"] }
        flagged = Array(s["items"]).select { |i| i["role"] == "my_part_flag" }.map { |i| i["id"] }
        next [] unless a.is_a?(Hash)

        a.flat_map do |thing, vals|
          vals = vals.is_a?(Hash) ? vals : {}
          picked = items.flat_map { |i| Array(vals[i]) }
          picked += [thing] if role == "my_part" && flagged.any? { |i| %w[Yes A\ little].include?(vals[i]) }
          picked
        end
      else []
      end
    end.map { |v| v.to_s.strip }.compact_blank
  end

  def as_api_json(full: false)
    json = { id: id, step: step, tool_key: tool_key, name: name, status: status, updated_at: updated_at.iso8601,
             created_at: created_at.iso8601, done_at: done_at&.iso8601 }
    return json unless full

    json.merge(definition: definition, answers: answers, settings: settings, credit: definition["credit"],
               remind_at: remind_at, remind_days: remind_days, auto_send: auto_send, auto_sent_at: auto_sent_at&.iso8601)
  end
end
