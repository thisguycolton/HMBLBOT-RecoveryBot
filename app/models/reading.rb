class Reading < ApplicationRecord
  has_rich_text :content
  has_rich_text :topic


  attr_accessor :hour, :minute, :meridiem

  after_validation :parse_time

  def parse_time
    if hour and minute and meridiem
      self.meetingTime = DateTime.parse("#{hour}:#{minute}#{meridiem}") 
    end
  end
end
