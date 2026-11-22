# Decisions cited in a document comment (GroupDocumentComment), as the cards the comment shows
# them by. A comment cites one of its group's decisions as [[decision:ID]] (the "Cite a
# decision" picker writes that), or by pasting a decision's shared link (/d/:token, any group's).
# Each viewer gets only what they may see: a decision they can see in the log (Motion.visible_to)
# links to it there; one they can't, but that's shared by link, shows what the link shows
# (Motion#public_json); anything else is just "a decision you can't see", with no title.
class DecisionRefs
  TOKEN = /\[\[decision:(\d{1,12})\]\]/
  LINK = %r{(?:https?://[^\s/]+)?/d/([A-Za-z0-9_-]{16,64})(?![A-Za-z0-9_-])}

  def initialize(group, viewer)
    @group = group
    @viewer = viewer
  end

  # { "decision:12" => card, "link:<token>" => card } for everything cited in these texts
  def cards_for(texts)
    texts = Array(texts).compact
    ids = texts.flat_map { |t| t.scan(TOKEN).flatten }.map(&:to_i).uniq
    tokens = texts.flat_map { |t| t.scan(LINK).flatten }.uniq
    return {} if ids.empty? && tokens.empty?

    by_id = ids.empty? ? {} : @group.motions.where(id: ids).index_by(&:id)
    by_token = tokens.empty? ? {} : Motion.includes(:group).where(share_token: tokens, needs_review: false).index_by(&:share_token)
    visible = Motion.visible_to(@group, @viewer).where(id: ids + by_token.values.select { |m| m.group_id == @group.id }.map(&:id)).pluck(:id).to_set

    cards = {}
    ids.each { |id| cards["decision:#{id}"] = card(by_id[id], visible) }
    tokens.each { |t| cards["link:#{t}"] = card(by_token[t], visible) }
    cards
  end

  # The text with citations as plain words, for a notification
  def self.plain(text) = text.to_s.gsub(TOKEN, "[a decision]")

  private

  def card(motion, visible)
    return { access: "none" } unless motion

    if visible.include?(motion.id)
      { access: "member", title: motion.title, status: motion.status, decided_on: motion.decided_on&.iso8601,
        url: "/groups/#{motion.group.slug}/conscience/decisions?open=#{motion.id}", shared_path: (motion.share_path if motion.shared?) }
    elsif motion.shared?
      data = motion.public_json
      { access: "public", title: data[:title], status: data[:status], decided_on: data[:decided_on], group: data.dig(:group, :title), url: motion.share_path }
    else
      { access: "none" }
    end
  end
end
