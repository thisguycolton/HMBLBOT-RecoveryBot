# What a shared link shows in Messages, Facebook, Slack and the rest: the title, a line about
# it and a picture (ShareCard), as og: and twitter: tags (application/_share_meta). Only for
# things anyone may open; for everything else the site's own card.
class ShareMeta
  SITE_DESCRIPTION = "Meetings, readings and tools for recovery groups."

  attr_reader :title, :description, :path, :kind, :id

  def initialize(title:, description:, path:, kind: "site", id: "recoverybot", card: nil)
    @title = title.to_s.squish
    @description = description.to_s.squish.truncate(200)
    @path = path
    @kind = kind
    @id = id
    @card = card
  end

  def self.site(title: "RecoveryBot", description: SITE_DESCRIPTION, path: "/")
    new(title: title, description: description, path: path)
  end

  # A preview that fails to come together leaves the page with the site's, not an error
  def self.safely
    yield
  rescue StandardError => e
    Rails.error.report(e, handled: true)
    nil
  end

  # The record's preview, or nil when it isn't for everyone
  def self.for(record)
    case record
    when GroupDocument then document(record)
    when Reading then reading(record)
    when Event then event(record)
    when Group then group(record)
    when Meeting then meeting(record)
    when OiaaMeeting then listing(record)
    end
  end

  def self.document(doc)
    group = doc.group
    return unless group.page_visible_to?(nil) && GroupDocument.visible_to(group, nil).exists?(doc.id)

    new(title: "#{doc.title} · #{group.title}", description: doc.summary.presence || "A document from #{group.title}.",
        path: "/groups/#{group.slug}/conscience/documents/#{doc.id}", kind: "document", id: doc.id, card: ShareCard.for(doc))
  end

  def self.reading(reading)
    return unless reading.published?

    from = reading.group&.page_visible_to?(nil) ? reading.group.title : nil
    name = reading.title.presence || reading.meetingName.presence || "Meeting reading"
    new(title: [name, from].compact.join(" · "),
        description: ["A meeting reading#{" from #{from}" if from}", reading.source.presence].compact.join(" · "),
        path: "/readings/#{reading.id}", kind: "reading", id: reading.id,
        card: from ? ShareCard.for(reading) : ShareCard.new(style: :page, title: name, kicker: "Meeting reading", subtitle: reading.source))
  end

  def self.event(event)
    return unless event.published?

    new(title: "#{event.title} · #{event.group.title}",
        description: [event.when_label, event.short_description.presence].compact.join(" · "),
        path: event.path, kind: "event", id: event.token, card: ShareCard.for(event))
  end

  def self.group(group)
    return unless group.active?

    new(title: group.title, description: group.description.presence || "#{group.title}'s meetings, events and more on RecoveryBot.",
        path: "/groups/#{group.slug}", kind: "group", id: group.slug, card: ShareCard.for(group))
  end

  def self.meeting(meeting)
    group = meeting.group
    return unless group.active?

    where = meeting.conference_url.present? ? "Online" : meeting.location.presence
    new(title: meeting.name.casecmp?(group.title) ? meeting.name : "#{meeting.name} · #{group.title}",
        description: [meeting.share_schedule_label, where, group.title].compact.uniq.join(" · "),
        path: "/groups/#{group.slug}/meetings/#{meeting.id}", kind: "meeting", id: meeting.id, card: ShareCard.for(meeting))
  end

  def self.listing(record)
    new(title: record.group_name.presence || record.name,
        description: [record.name, record.schedule_label, "AA Intergroup"].uniq.join(" · "),
        path: "/groups/find/#{ERB::Util.url_encode(record.slug)}", kind: "listing", id: record.slug, card: ShareCard.for(record))
  end

  # Where a record's shared link goes, and its card's kind and id, without drawing anything
  def self.path_for(record)
    case record
    when Group then { path: "/groups/#{record.slug}", kind: "group", id: record.slug }
    when Meeting then { path: "/groups/#{record.group.slug}/meetings/#{record.id}", kind: "meeting", id: record.id }
    when OiaaMeeting then { path: "/groups/find/#{ERB::Util.url_encode(record.slug)}", kind: "listing", id: record.slug }
    end
  end

  def card = @card ||= ShareCard.site

  # The picture's address; the card's key in it gives every new look a new URL, which the
  # apps that keep previews (Facebook, iMessage) then fetch again
  def image_path = "/share_cards/#{kind}/#{ERB::Util.url_encode(id.to_s)}.png?v=#{card.key.first(12)}"
end
