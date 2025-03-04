class Reading < ApplicationRecord
  has_rich_text :content
  has_richer_text :richer_content, store_as: :json
  has_rich_text :topic
  belongs_to :user, optional: true
  belongs_to :group, optional: true
  def self.ransackable_attributes(auth_object = nil)
    ["title"]
  end
  def self.ransackable_associations(auth_object = nil)
    ["richer_content", "content"]
  end

  attr_accessor :hour, :minute, :meridiem

  after_validation :parse_time

  def parse_time
    if hour and minute and meridiem
      self.meetingTime = DateTime.parse("#{hour}:#{minute}#{meridiem}")
    end
  end
end
