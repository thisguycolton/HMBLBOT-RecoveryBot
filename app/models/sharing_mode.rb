# A reusable way of approaching any topic ("Story", "Check-In", ...). ACID QUEST combines
# TOPIC + SHARING MODE instead of storing a finished question for every topic. Prompts talk
# about "this" because the topic is shown above them as a heading.
class SharingMode < ApplicationRecord
  validates :key, presence: true, uniqueness: true
  validates :name, :prompt, presence: true

  scope :active, -> { where(active: true).order(:position) }
end
