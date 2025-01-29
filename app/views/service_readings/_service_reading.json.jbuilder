json.extract! service_reading, :id, :title, :short_title, :body, :source, :created_at, :updated_at
json.url service_reading_url(service_reading, format: :json)
json.body service_reading.body.to_s
