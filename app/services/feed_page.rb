# One page of a feed of notes (TimelineNote, reposts too) and shared highlights (UserHighlight),
# newest first: the home page, a profile's feed, a #hashtag's page and a group's Timeline block.
# Feeds come a page at a time, behind a "Load more" button, never endlessly as you scroll.
#
# Pages are keyset pages, not offsets: `next` is a cursor naming the last item on this page
# (its time to the microsecond, which kind it is, its id), and the next page starts right after
# it. A note posted while you read lands at the top and never pushes an item onto two pages, and
# two items from the same second are never skipped. A plain ISO 8601 time (the old `before`) still
# works as a cursor: everything older than that time.
class FeedPage
  SIZE = 20

  # Ties at the same moment sort notes ahead of highlights, then by id, newest first
  NOTE = 1
  HIGHLIGHT = 0

  # notes: a TimelineNote scope; highlights: a UserHighlight scope (shared ones) or nil.
  # `as_json` turns a note into its feed JSON (default: as_api_json for the viewer).
  def initialize(viewer:, notes:, highlights: nil, cursor: nil, size: SIZE, as_json: nil)
    @viewer = viewer
    @notes = notes
    @highlights = highlights
    @cursor = self.class.parse(cursor)
    @size = size
    @as_json = as_json || ->(note) { note.as_api_json(viewer: viewer) }
  end

  # -> { items: [feed JSON], next: cursor or nil when there's nothing older }
  def call
    rows = notes_page.map { |n| [n.created_at, NOTE, n.id, n] }
    rows += highlights_page.map { |h| [h.shared_at, HIGHLIGHT, h.id, h] } if @highlights
    rows.sort_by! { |time, rank, id, _| [time, rank, id] }
    rows.reverse!
    page = rows.first(@size)
    more = rows.size > @size
    {
      items: page.map { |_, rank, _, record| rank == NOTE ? @as_json.call(record) : record.as_feed_json(viewer: @viewer) },
      next: (self.class.cursor(*page.last.first(3)) if more && page.any?),
    }
  end

  def self.cursor(time, rank, id) = "#{time.utc.iso8601(6)}~#{rank}~#{id}"

  # -> [Time, rank, id], or nil for no cursor (the first page) or one that doesn't parse
  def self.parse(cursor)
    return if cursor.blank?

    time, rank, id = cursor.to_s.split("~", 3)
    # A bare time: everything strictly older (a rank below both kinds says "not this moment")
    return [Time.iso8601(time), -1, 0] if rank.nil?

    [Time.iso8601(time), rank.to_i, id.to_i]
  rescue ArgumentError
    nil
  end

  private

  def notes_page
    scope = after(@notes, "created_at", NOTE)
    scope.for_feed.reorder(created_at: :desc, id: :desc).limit(@size + 1).to_a
  end

  def highlights_page
    people = { user: { avatar_attachment: :blob } }
    scope = after(@highlights, "shared_at", HIGHLIGHT)
    scope.includes(:reposts, reactions: people, chapter: :book, **people)
         .reorder(shared_at: :desc, id: :desc).limit(@size + 1).to_a
  end

  # The rows that sort after the cursor in (time, rank, id) order, newest first
  def after(scope, column, rank)
    return scope unless @cursor

    time, at_rank, id = @cursor
    col = "#{scope.table_name}.#{column}"
    if rank < at_rank
      scope.where("#{col} <= ?", time)
    elsif rank > at_rank
      scope.where("#{col} < ?", time)
    else
      scope.where("(#{col}, #{scope.table_name}.id) < (?, ?)", time, id)
    end
  end
end
