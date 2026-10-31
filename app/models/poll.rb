class Poll < ApplicationRecord
  moderates_language :description
  has_rich_text :description
  has_many :options, dependent: :destroy

  accepts_nested_attributes_for :options
end
