json.extract! reading, :id, :title, :source, :source_url, :created_at, :updated_at
json.url reading_url(reading, format: :json)
# A Grapevine reading outside its public window comes with its excerpt instead of its words
if reading.full_text_for?(current_user)
  json.content reading.content.to_s
else
  json.text_locked true
  json.excerpt reading.excerpt
end
json.topic reading.topic.to_s
