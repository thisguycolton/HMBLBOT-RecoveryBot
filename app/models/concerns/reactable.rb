# Something people react to with Like, Love or Hugs (NoteReaction): timeline notes and
# their comments. Whoever may see it (`visible_to?`) may react.
module Reactable
  extend ActiveSupport::Concern

  REACTORS_MAX = 50

  included do
    has_many :reactions, as: :reactable, class_name: "NoteReaction", dependent: :delete_all
  end

  # How many of each, the viewer's, and who reacted how, newest first, leaving out people the
  # viewer blocked (preload
  # `reactions: { user: { avatar_attachment: :blob } }` for a list of them)
  def reactions_json(viewer)
    counts = NoteReaction::KINDS.index_with { |k| reactions.count { |r| r.kind == k } }
    blocked = viewer ? viewer.blocked_ids : []
    reactors = reactions.reject { |r| blocked.include?(r.user_id) }.sort_by(&:created_at).reverse.first(REACTORS_MAX)
                        .map { |r| r.user.as_person_json.merge(reaction: r.kind) }
    { reactions: counts, my_reaction: reactions.find { |r| r.user_id == viewer&.id }&.kind, reactors: reactors }
  end
end
