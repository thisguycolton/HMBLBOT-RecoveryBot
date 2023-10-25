json.extract! reading, :id, :title, :content, :topic, :created_at, :updated_at
json.url reading_url(reading, format: :json)
json.content reading.content.to_s
json.topic reading.topic.to_s
