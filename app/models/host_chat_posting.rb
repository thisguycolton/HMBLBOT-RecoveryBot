# Something the host pastes into the meeting's Zoom chat at a set minute (the welcome, the
# Preamble, the 7th Tradition link), with a short title and a Lucide icon to find it by.
class HostChatPosting < ApplicationRecord
  BODY_MAX = 4000

  belongs_to :hosting_kit, inverse_of: :postings

  before_validation do
    self.title = title.to_s.squish
    self.icon = icon.to_s.strip.downcase.presence
    self.body = body.to_s.gsub("\r\n", "\n").strip
  end

  validates :title, presence: true, length: { maximum: 60 }
  validates :icon, format: { with: /\A[a-z0-9-]{1,60}\z/ }, allow_nil: true
  validates :minute, numericality: { only_integer: true, in: 0..600 }
  validates :body, presence: true, length: { maximum: BODY_MAX }

  def as_api_json = { id: id, title: title, icon: icon, minute: minute, body: body }
end
