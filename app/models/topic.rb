class Topic < ApplicationRecord
  # How deep a topic goes, curated by hand for ACID QUEST (nil reads as standard)
  DIFFICULTIES = %w[gentle standard deep].freeze

  belongs_to :topic_category, optional: true
  has_many :topic_tags, dependent: :destroy
  has_many :tags, through: :topic_tags
  has_many :topic_sharing_prompts, dependent: :destroy

  validates :difficulty, inclusion: { in: DIFFICULTIES }, allow_nil: true
  def sub_long?
    subtitle.present? && subtitle.length > 20
  end
  def self.ransackable_attributes(auth_object = nil)
    ["created_at", "id", "searchable_number", "title", "updated_at", "subtitle"]
  end
    def self.ransackable_associations(auth_object = nil)
    []
  end
end
