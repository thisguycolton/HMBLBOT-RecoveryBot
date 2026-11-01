# Something a sponsee sent their sponsor (Sponsorship): a gratitude list or 10th step as it
# read when they sent it (`title` and `body` are the same plain text Share makes, without
# the sign-up link). Editing the entry afterwards doesn't change it. Sending the same day's
# entry again while the sponsor hasn't opened it yet replaces it; after that it's a new one.
#
# The sponsor can leave one short note on it (`reply`), which they can change, and nothing
# more: it isn't a chat. The sponsee can take it back. It goes when the sponsorship ends.
class SponsorshipShare < ApplicationRecord
  moderates_language :title, :body, :reply

  KINDS = { "gratitude" => "gratitude list", "inventory" => "10th step" }.freeze
  BODY_MAX = 20_000
  REPLY_MAX = 500

  belongs_to :sponsorship

  validates :kind, inclusion: { in: KINDS.keys }
  validates :on, :title, :body, presence: true
  validates :title, length: { maximum: 200 }
  validates :body, length: { maximum: BODY_MAX }
  validates :reply, length: { maximum: REPLY_MAX }

  before_validation do
    self.title = title.to_s.squish
    self.body = body.to_s.strip
    self.reply = reply.to_s.strip.presence
  end

  def as_api_json
    { id: id, kind: kind, on: on.iso8601, title: title, body: body, sent_at: (updated_at || created_at).iso8601,
      seen: seen_at.present?, reply: reply, replied_at: replied_at&.iso8601 }
  end
end
