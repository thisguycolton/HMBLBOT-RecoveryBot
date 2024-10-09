json.extract! meeting, :id, :datetime, :host, :reocurring, :frequency, :group_id, :created_at, :updated_at
json.url meeting_url(meeting, format: :json)
