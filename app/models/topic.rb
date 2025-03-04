class Topic < ApplicationRecord
  belongs_to :topic_category, optional: true
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
