# One version of a GroupDocument, like a commit: the document as someone saved it (title, text
# and file), numbered from 1, with their note about what changed, everyone whose edits went
# into it, and a summary of the change from the version before (words added and removed, and
# the sections they were in; DocumentDiff). The newest one is the document as it is.
class GroupDocumentVersion < ApplicationRecord
  moderates_language :message
  # created: the document's first version; restored: an older version put back
  KINDS = %w[created saved restored].freeze

  belongs_to :group_document, inverse_of: :versions
  belongs_to :user, optional: true
  belongs_to :restored_from, class_name: "GroupDocumentVersion", optional: true
  has_one_attached :file

  validates :number, presence: true, uniqueness: { scope: :group_document_id }
  validates :kind, inclusion: { in: KINDS }

  # people: { id => User } for the contributors (the controller loads them all at once)
  def as_api_json(people: {}, full: false)
    json = {
      id: id, number: number, kind: kind, message: message, title: title, created_at: created_at.iso8601,
      user: user&.as_person_json, contributors: contributor_ids.filter_map { |i| people[i]&.as_person_json },
      words_added: words_added, words_removed: words_removed, sections: sections_changed,
      restored_from: restored_from&.number, file: file.attached? ? { name: file.filename.to_s, size: file.byte_size } : nil,
    }
    json.merge!(body: body.to_s, body_format: body_format) if full
    json
  end
end
