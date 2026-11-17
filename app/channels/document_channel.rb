# A group document being edited live (GroupDocument::Live, lib/liveDocument.js). Anyone who can
# read the document listens and shares who they are and where their cursor is (Yjs awareness);
# record keepers' edits are numbered, kept and passed on.
class DocumentChannel < ApplicationCable::Channel
  # Edits bigger than this go out as just their number, and browsers fetch them, since Postgres
  # (the production cable) won't carry a message over 8,000 bytes
  INLINE_MAX = 6_000
  AWARENESS_MAX = 6_000

  # params: group (slug), id, client (the browser's Yjs client id)
  def subscribed
    return reject unless GroupDocument.live_editing?

    @group = Group.find_by(slug: params[:group])
    return reject unless @group&.page_visible_to?(current_user)

    @document = GroupDocument.visible_to(@group, current_user).find_by(id: params[:id])
    return reject unless @document

    @client = params[:client].to_i
    stream_from @document.live_stream
  end

  def unsubscribed
    say(type: "left") if @document
  end

  # { update: base64, epoch:, mid: } -> everyone gets { type: "update", seq:, update?, mid:, from: }
  def update(data)
    return unless @group.records_editable_by?(current_user)

    bytes = decode(data["update"]) or return
    seq = @document.live_append!(bytes, current_user, data["epoch"])
    return transmit({ type: "stale", mid: data["mid"] }) unless seq

    message = { type: "update", seq: seq, mid: data["mid"].to_s.first(40) }
    message[:update] = data["update"] if data["update"].bytesize <= INLINE_MAX
    say(**message)
  end

  # { update: base64 (y-protocols awareness), hello: true when just arrived (others answer with
  # theirs) }
  def awareness(data)
    update = data["update"].to_s
    return if update.bytesize > AWARENESS_MAX || decode(update).nil?

    say(type: "awareness", update: update, hello: data["hello"] ? true : nil)
  end

  private

  def say(**message) = ActionCable.server.broadcast(@document.live_stream, message.compact.merge(from: @client))

  def decode(value)
    Base64.strict_decode64(value.to_s)
  rescue ArgumentError
    nil
  end
end
