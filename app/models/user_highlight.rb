# app/models/user_highlight.rb
class UserHighlight < ApplicationRecord
  moderates_language :note
  # Highlights stay with their reader until they share one to their timeline: then
  # `visibility` (Followers or Members) says who sees it there and `shared_at` dates it in
  # the feed. Setting it back to private takes it off every timeline, theirs included.
  # Share links (?hl=, ?share=) work whatever this says.
  #
  # Its note can hold #hashtags and @ mentions, as timeline notes do (Hashtags, Mentionable).
  # A tag's page (/people/tags/:tag) lists only shared highlights, to the people who can see
  # them on their owner's timeline (seen_by). People @ mentioned are told once it's shared
  # and they can see it, so a private highlight tells nobody until its owner shares it.
  # Highlights aren't shared to groups, so role handles (@hosts...) mean nothing here.
  include Visibility
  include Mentionable

  belongs_to :user
  belongs_to :chapter

  scope :for_chapter_slug, ->(slug) { joins(:chapter).where(chapters: { slug: slug }) }
  scope :on_timeline, -> { where.not(shared_at: nil) }
  scope :tagged, ->(tag) { where("user_highlights.hashtags @> ARRAY[?]::varchar[]", tag) }
  scope :not_blocked_by, ->(viewer) { viewer ? where.not(user_id: UserBlock.where(blocker_id: viewer.id).select(:blocked_id)) : all }

  # Every shared highlight `viewer` may see on its owner's timeline, as visible_to? says for
  # one: their own shared ones, and others' shared with Members or with their followers.
  # People they blocked are left out.
  def self.seen_by(viewer)
    return none unless viewer

    seen = on_timeline.where(user_id: viewer.id)
    if User.profiles_open_to?(viewer)
      followed = Follow.where(follower_id: viewer.id).select(:followed_id)
      seen = seen.or(on_timeline.where(visibility: "public")).or(on_timeline.where(visibility: "followers", user_id: followed))
    end
    seen.not_blocked_by(viewer)
  end

  before_save do
    if visibility == "private" then self.shared_at = nil
    else self.shared_at ||= Time.current
    end
  end

  def shared? = shared_at.present?

  before_save { self.hashtags = Hashtags.in(note) if note_changed? || new_record? }

  # Whether `viewer` can see it on its owner's timeline: its owner always, anyone else only
  # once it's shared, as `visibility` says
  def visible_to?(viewer)
    return false unless viewer
    return true if viewer.id == user_id
    return false unless shared? && User.profiles_open_to?(viewer)

    visibility == "public" || (visibility == "followers" && Follow.exists?(follower_id: viewer.id, followed_id: user_id))
  end

  # Where it shows: in its chapter, opened on it
  def page_path
    "/books/#{chapter.book.slug}/chapters/#{chapter.slug}?hl=#{CGI.escape(signed_id(purpose: :share))}#hl-#{id}"
  end

  # Reads the @ mentions in its note, and tells the people newly mentioned who can see it.
  # While it's private nobody is told; sharing it (or sharing it more widely) tells them then.
  def mention!(author)
    people = take_mentions(note, author: author, everyone: false, can_see: ->(u) { shared? && visible_to?(u) })
    save! if changed?
    tell_mentioned(people, kind: "mention.note", body: note.to_s.truncate(200), url: page_path, from: author,
                           title: ->(_) { "#{author.display_name} mentioned you in a highlight note" })
  end


  validates :selector, presence: true
  validates :style, presence: true
  validates :note, length: { maximum: 10_000 }

  # As a profile feed shows it: the quote, its note and where it's from
  def as_feed_json(viewer:)
    {
      kind: "highlight", id: id, created_at: (shared_at || created_at).iso8601, mine: viewer&.id == user_id, author: user.as_person_json,
      quote: selector.dig("quote", "exact"), note: note, mentions: mentions, mentions_me: mentions?(viewer), color: style["color"], visibility: (visibility if viewer&.id == user_id),
      book_slug: chapter.book.slug, book_title: chapter.book.title, chapter_slug: chapter.slug, chapter_title: chapter.title,
      share_id: signed_id(purpose: :share),
    }
  end
end
