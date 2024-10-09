class Group < ApplicationRecord
  has_many :readings
  has_many :meetings
  has_many :users

  accepts_nested_attributes_for :meetings, reject_if: lambda { |attributes| attributes['host'].blank? }, allow_destroy: true
end
