# The copy a GroupDocument had before one of its saves: who wrote it, when, its title,
# text and file.
class GroupDocumentVersion < ApplicationRecord
  belongs_to :group_document
  belongs_to :user, optional: true
  has_one_attached :file

  def as_api_json
    { id: id, title: title, body: body.to_s, body_format: body_format, created_at: created_at.iso8601, user: user&.display_name,
      file: file.attached? ? { name: file.filename.to_s, size: file.byte_size } : nil }
  end
end
