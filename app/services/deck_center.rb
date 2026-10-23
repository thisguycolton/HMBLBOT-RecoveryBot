# A deck of its own (Deck) as its page has it (/groups/:slug/decks/:id), in the same shape as a
# meeting's HostDeck (HostingCenter), so the same blocks draw it: the deck where a meeting would
# be, its script document, its layout, and the live state of today's session. Its clock runs from
# when a host starts it, not from a start time.
class DeckCenter
  def initialize(deck, viewer, now: Time.current)
    @deck = deck
    @group = deck.group
    @viewer = viewer
    @now = now
    @on = now.in_time_zone(@group.zone).to_date
  end

  def session = @session ||= @deck.session_on(@on)
  def layout_key = Digest::MD5.hexdigest(@deck.arrangement.to_json)[0, 12]

  def as_json(*)
    editor = @group.decks_editable_by?(@viewer)
    script = @deck.script_document
    visible = script && GroupDocument.visible_to(@group, @viewer).exists?(id: script.id)
    started = session.timer_started_at
    json = {
      deck: { id: @deck.id, name: @deck.name, purpose: @deck.purpose, script_document_id: @deck.script_document_id },
      group: { slug: @group.slug, title: @group.title, logo_url: @group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.logo, only_path: true) : nil },
      meeting: { id: nil, name: @deck.name, time_zone: @group.zone.tzinfo.name },
      on: @on.iso8601, starts_at: started&.iso8601, ends_at: nil, hosts: {}, my_role: nil,
      kit: {
        own: true, exists: true, script_hidden: !!script && !visible, activity_anchor: "none", postings: [], readings: [], service_roles: [],
        script: visible ? { id: script.id, title: script.title, body: script.body.to_s, body_format: script.body_format, updated_at: script.updated_at.iso8601 } : nil,
      },
      can_edit: editor, can_arrange: editor,
      layout: { arrangement: @deck.arrangement, scope: "deck", key: layout_key },
      live: session.live_json(@viewer, @now), activity_options: { daily: [], books: [], topic_sets: [] }, previous: [], link: nil,
    }
    json[:editor] = { documents: documents } if editor
    json
  end

  private

  # What a deck can be run from: the group's current documents members can read
  def documents
    @group.documents.where(status: "current", visibility: %w[public members hosts]).order(:title).map { |d| { id: d.id, title: d.title, kind: d.kind } }
  end
end
