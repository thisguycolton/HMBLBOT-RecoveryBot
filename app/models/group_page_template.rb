# The default group page: what AA Intergroup groups that aren't here yet show
# (/groups/find/:oiaa_slug), and what a group shows until it saves its own page. Site admins
# edit it in the HMBLBOT Editor at /groups/default-page/edit. There's one, keyed "default".
class GroupPageTemplate < ApplicationRecord
  KEY = "default"

  # Where the default page starts; {{group}} is each group's name
  STARTER_BLOCKS = [
    { type: "heading", region: "main", text: "Welcome to {{group}}", level: 2 },
    { type: "notes", region: "main",
      markdown: "We're people in recovery who meet to share our experience, strength and hope with each other. " \
                "If you want to stop drinking, you're welcome here. Come as you are." },
    { type: "meetings", region: "main" },
    { type: "timeline", region: "main" },
    { type: "join", region: "side", color: "accent" },
    { type: "events", region: "side" },
    { type: "literature", region: "side" },
    { type: "members", region: "side" },
  ].freeze

  belongs_to :updated_by, class_name: "User", optional: true
  has_one_attached :cover
  # Pictures placed in its blocks
  has_many_attached :images

  before_validation { self.blocks = EventBlocks.normalize(blocks, types: EventBlocks::GROUP_TYPES) }

  validates :key, presence: true, uniqueness: true
  validates :layout, inclusion: { in: Event::LAYOUTS }

  def self.current
    find_or_create_by!(key: KEY) { |t| t.blocks = STARTER_BLOCKS.map(&:deep_stringify_keys) }
  rescue ActiveRecord::RecordNotUnique
    find_by!(key: KEY)
  end
end
