# A copy of a DocPage as it was before a save changed it (DocPage#record_version), so an older
# text can be put back from the editor's History.
class DocPageVersion < ApplicationRecord
  belongs_to :doc_page
  belongs_to :saved_by, class_name: "User", optional: true

  def as_api_json(full: false)
    json = { id: id, title: title, created_at: created_at.iso8601, saved_by: saved_by&.display_name, words: body.to_s.split.size }
    json[:body] = body if full
    json
  end
end
