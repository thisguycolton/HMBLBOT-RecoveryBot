# One answer in a Poll: typed text, or (in the old topic polls) a Topicificator topic
class Option < ApplicationRecord
  moderates_language :label
  belongs_to :poll
  belongs_to :topic, optional: true

  before_validation { self.label = label.to_s.squish.presence }
  validates :label, length: { maximum: 200 }
  validate { errors.add(:base, "Every answer needs some text") if display_label.blank? }

  def display_label = label.presence || topic_title.presence || topic&.title.to_s
end
