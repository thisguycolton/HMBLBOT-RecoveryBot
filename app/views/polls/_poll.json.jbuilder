json.extract! poll, :id, :closeDate, :closeTime, :description, :created_at, :updated_at
json.url poll_url(poll, format: :json)
json.description poll.description.to_s
