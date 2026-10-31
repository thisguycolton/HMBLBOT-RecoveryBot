class ServiceReading < ApplicationRecord
  moderates_language :title, :short_title, :body
  has_rich_text :body
end
