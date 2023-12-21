json.extract! page, :id, :book_id, :content, :page_number, :created_at, :updated_at
json.url page_url(page, format: :json)
