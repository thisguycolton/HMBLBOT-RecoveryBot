# A column on Site Admin > Task board (SCRUMBLBOT). Its kind says what being in it means:
# "start" is waiting for someone (Up for grabs), "doing" is being worked on, and "finished"
# is done. The board always has exactly one finished column and at least one start column.
class AdminTaskColumn < ApplicationRecord
  KINDS = %w[start doing finished].freeze

  moderates_language :name
  has_many :tasks, -> { order(:position, :id) }, class_name: "AdminTask", dependent: :restrict_with_error

  before_validation { self.name = name.to_s.squish }
  validates :name, presence: true, length: { maximum: 60 }
  validates :kind, inclusion: { in: KINDS }
  validate :keeps_the_board_whole, on: :update, if: :will_save_change_to_kind?

  scope :ordered, -> { order(:position, :id) }

  def self.finished = ordered.find_by(kind: "finished")
  def self.first_start = ordered.find_by(kind: "start") || ordered.first
  def self.first_doing = ordered.find_by(kind: "doing") || ordered.where.not(kind: "finished").first

  def finished? = kind == "finished"
  def start? = kind == "start"

  # Why this column can't be removed, or nil
  def removal_problem
    return "Move its tasks to another column first." if tasks.exists?
    return "The board needs a Done column." if finished?
    return "The board needs at least one starting column." if start? && AdminTaskColumn.where(kind: "start").count <= 1

    nil
  end

  def as_api_json = { id: id, name: name, kind: kind, position: position }

  private

  def keeps_the_board_whole
    was = kind_was
    if was == "finished" || kind == "finished"
      errors.add(:kind, "can't change: the board has exactly one Done column")
    elsif was == "start" && AdminTaskColumn.where(kind: "start").where.not(id: id).none?
      errors.add(:kind, "can't change: the board needs at least one starting column")
    end
  end
end
