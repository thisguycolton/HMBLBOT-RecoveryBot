# A timeline note shared to one of its author's groups
class TimelineNoteShare < ApplicationRecord
  belongs_to :timeline_note
  belongs_to :group

  validates :group_id, uniqueness: { scope: :timeline_note_id }
end
