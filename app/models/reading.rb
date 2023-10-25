class Reading < ApplicationRecord
  has_rich_text :content
  has_rich_text :topic
end
