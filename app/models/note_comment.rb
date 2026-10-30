# A comment on a timeline note, like a small note of its own: Markdown, reactions, edited
# or deleted by its writer (the note's author can delete it too). Anyone who can see the
# note can comment, and sees its comments; a repost's comments go to the original.
class NoteComment < ApplicationRecord
  include Reactable
  include Mentionable

  BODY_MAX = 2_000

  belongs_to :timeline_note
  belongs_to :user

  validates :body, presence: true, length: { maximum: BODY_MAX }

  def visible_to?(viewer) = timeline_note.visible_to?(viewer)
  def removable_by?(viewer) = !!viewer && (viewer.id == user_id || timeline_note.removable_by?(viewer))
  def group = nil

  # Tells who it newly @ mentions, if they can see the note (role handles from the groups it's shared to)
  def mention!(author)
    note = timeline_note
    people = take_mentions(body, author: author, groups: note.groups.to_a, everyone: false, can_see: ->(u) { note.visible_to?(u) })
    save! if mentions_changed?
    tell_mentioned(people, kind: "mention.note", body: body.truncate(200), url: note.page_path,
                           title: ->(handle) { "#{author.display_name} mentioned #{handle ? "@#{handle}" : 'you'} in a comment" })
  end
  def edited? = updated_at - created_at > 1.minute

  def as_api_json(viewer:)
    { id: id, body: body, mentions: mentions, created_at: created_at.iso8601, edited: edited?, author: user.as_person_json,
      mine: viewer&.id == user_id, can_remove: removable_by?(viewer), **reactions_json(viewer) }
  end
end
