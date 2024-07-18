class Option < ApplicationRecord
  belongs_to :poll
  belongs_to :topic
end
