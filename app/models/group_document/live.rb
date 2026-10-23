# Live editing: several people typing into one document at once, each seeing the others' edits
# and cursors as they happen (DocumentChannel, lib/liveDocument.js).
#
# The browsers do the merging (Yjs, a CRDT, so edits from different people never clash); the
# server only numbers each edit, passes it on and keeps it. Every so often a browser that's been
# typing sends back the whole merged copy along with its HTML, which becomes `body` (so reading,
# search, export and the Command Center keep working as before), and the edits it covers are
# dropped. Live edits never make a version on their own: the first one after a Save version keeps
# the copy the document had, the way a save does, and later ones until the next Save don't.
#
# Switched on with COLLAB_EDITING=1.
module GroupDocument::Live
  extend ActiveSupport::Concern

  # Biggest single edit, and biggest whole copy, a browser may send
  UPDATE_MAX = 512.kilobytes
  STATE_MAX = 8.megabytes

  class_methods do
    def live_editing? = ENV["COLLAB_EDITING"] == "1"
  end

  included do
    has_many :live_updates, -> { order(:seq) }, class_name: "GroupDocumentLiveUpdate", dependent: :delete_all
  end

  def live_stream = "group_document_live:#{id}"

  # Everything a browser needs to start: the merged copy (nil until someone first opens the
  # document to edit it) and the edits since, or only the edits after `after`
  def live_snapshot(after: nil)
    if after
      return { epoch: live_epoch, seq: live_seq, updates: updates_json(live_updates.where("seq > ?", after.to_i)) } if after.to_i >= live_state_seq

      after = nil # those were folded into the copy; start over from it
    end
    { epoch: live_epoch, seq: live_seq, state_seq: live_state_seq, state: live_state && Base64.strict_encode64(live_state),
      updates: updates_json(live_updates.where("seq > ?", live_state_seq)), unversioned: live_unversioned }
  end

  # The first copy, made in the browser from the document's HTML (`html`: an older Markdown
  # document as the browser converted it). Only one wins (two people opening a document at the
  # same moment would otherwise each add its text); returns whether this one did.
  def live_start!(state, epoch, html: nil)
    with_lock do
      next false if live_state || epoch.to_i != live_epoch || state.bytesize > STATE_MAX

      attrs = { live_state: state, live_state_seq: live_seq }
      attrs.merge!(body: DocumentHtml.sanitize(html.to_s), body_format: "html") if body_format == "markdown"
      update_columns(attrs)
      true
    end
  end

  # One edit: numbered and kept. nil when the browser holds an old copy (see live_epoch) or the
  # document hasn't started yet.
  def live_append!(data, user, epoch)
    return if data.bytesize > UPDATE_MAX

    with_lock do
      next if live_state.nil? || epoch.to_i != live_epoch

      seq = live_seq + 1
      live_updates.create!(seq: seq, data: data, user: user, created_at: Time.current)
      update_columns(live_seq: seq)
      seq
    end
  end

  # The merged copy as of edit `upto`, with its title and HTML. Keeps the copy the document had
  # (a version) if this is the first change since the last Save version. Returns whether it took
  # (a copy older than the one kept, or from before a restore, doesn't).
  def live_fold!(state, upto:, epoch:, title:, body:, user:)
    upto = upto.to_i
    return false if state.bytesize > STATE_MAX

    with_lock do
      next false if live_state.nil? || epoch.to_i != live_epoch || upto < live_state_seq || upto > live_seq

      title = title.to_s.squish.presence || self.title
      body = DocumentHtml.sanitize(body.to_s)
      next false if body.length > GroupDocument::BODY_MAX

      changed = title != self.title || body != self.body
      if changed && !live_unversioned
        versions.create!(user_id: updated_by_id || created_by_id, title: self.title, body: self.body, body_format: body_format, created_at: updated_at)
      end
      attrs = { live_state: state, live_state_seq: upto }
      attrs.merge!(title: title.first(160), body: body, body_format: "html", updated_by_id: user&.id, updated_at: Time.current, live_unversioned: true) if changed
      update_columns(attrs)
      live_updates.where("seq <= ?", upto).delete_all
      true
    end
  end

  # Save version: the text as it stands is the one the next live edit keeps a copy of
  def live_checkpoint! = update_columns(live_unversioned: false)

  # The text was replaced another way (a restore, or a save from a tab that isn't live): the
  # browsers drop their copies and start again from the new text
  def live_reset!
    return if live_state.nil? && live_seq.zero?

    live_updates.delete_all
    update_columns(live_state: nil, live_state_seq: 0, live_seq: 0, live_epoch: live_epoch + 1, live_unversioned: false)
    ActionCable.server.broadcast(live_stream, { type: "reset", epoch: live_epoch })
  end

  private

  def updates_json(scope) = scope.pluck(:seq, :data).map { |seq, data| { seq: seq, update: Base64.strict_encode64(data) } }
end
