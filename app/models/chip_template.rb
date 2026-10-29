# Art for illustrated chips (ChipDesign emblem "scene"), made in the chip art editor: imported
# from an SVG (ChipArt), its layers set, painted with the bucket, and given named palettes and
# default words. Site-wide templates (no group) are made in Site Admin > Chip templates and
# every group can use the published ones; a group's own imports are only for that group, and a
# site admin can hide them.
#
# `art`, `palettes` and `defaults` are the draft being edited. Publishing freezes them as the
# next version (ChipTemplateVersion), and designs point at a version, so editing a template
# never changes a chip anyone already has. A group's own art publishes as it saves.
class ChipTemplate < ApplicationRecord
  FITS = %w[round triangle both].freeze
  STATUSES = %w[draft published retired].freeze
  # What a template sets for the chips that use it (ChipDesign's round keys)
  DEFAULT_KEYS = %w[finish metal milestone_at edge top_text bottom_text back_text back_ring_top back_ring_bottom palette layout milestones].freeze

  belongs_to :group, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  has_many :versions, -> { order(:number) }, class_name: "ChipTemplateVersion", dependent: :destroy

  validates :title, presence: true, length: { maximum: 60 }
  validates :fits, inclusion: { in: FITS }
  validates :status, inclusion: { in: STATUSES }
  validate { errors.add(:art, "needs at least one shape") if art.blank? || art["layers"].blank? }

  before_validation do
    self.art = ChipArt.clean(art) || {}
    self.palettes = ChipArt.clean_palettes(palettes, art)
    self.defaults = clean_defaults(defaults)
  end

  scope :site, -> { where(group_id: nil) }
  scope :published, -> { where(status: "published") }
  scope :ordered, -> { order(:position, :title) }
  # What a group can put on its chips: published site templates and its own art, unless hidden
  scope :usable_by, ->(group) { published.where(hidden: false).where(group_id: [nil, group&.id].uniq).ordered }

  def latest = versions.last
  def site? = group_id.nil?

  # Freezes the draft as the next version
  def publish!
    transaction do
      versions.create!(number: (versions.maximum(:number) || 0) + 1, art: art, palettes: palettes, defaults: defaults)
      update!(status: "published")
    end
    versions.reset
    latest
  end

  # Imports an SVG as a new template (ChipArt::Invalid when it can't be used)
  def self.import(svg, **attrs)
    art = ChipArt.from_svg(svg)
    new(attrs.merge(art: art))
  end

  # For lists and pickers: the latest published version's art, so a thumbnail can be drawn
  def as_api_json
    v = latest
    { id: id, title: title, fits: fits, status: status, own: !site?, hidden: hidden, source: source, license: license,
      group: (group && { slug: group.slug, title: group.title }), version: v&.number,
      art: v&.art, palettes: v&.palettes, defaults: v&.defaults, updated_at: updated_at.iso8601 }.compact
  end

  # For the editor: the draft, and whether it has changes since the last publish
  def as_editor_json
    v = latest
    as_api_json.merge(draft: { art: art, palettes: palettes, defaults: defaults },
                      changed: v.nil? || v.art != art || v.palettes != palettes || v.defaults != defaults,
                      colors: ChipArt.colors(art))
  end

  private

  def clean_defaults(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    return {} unless raw.is_a?(Hash)

    raw = raw.stringify_keys
    words = ChipDesign.normalize("round" => raw.slice(*(DEFAULT_KEYS - %w[finish metal palette layout milestones])))["round"] || {}
    words.merge({ "finish" => (raw["finish"] if ChipDesign::SCENE_FINISHES.include?(raw["finish"])),
                  "metal" => (raw["metal"] if ChipDesign::METALS.key?(raw["metal"])),
                  "palette" => raw["palette"].to_s.squish.first(30).presence,
                  "layout" => ChipDesign.layout(raw["layout"]),
                  # The scene's look at each milestone, round and Meeting Maker
                  "milestones" => template_milestones(raw["milestones"]) }.compact)
  end

  def template_milestones(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    return nil unless raw.is_a?(Hash)

    only = %w[palette art_finish metal]
    round = ChipDesign.milestone_looks(raw.reject { |k, _| k.to_s.start_with?("n") }, "round", only: only) || {}
    meeting = ChipDesign.milestone_looks(raw.select { |k, _| k.to_s.start_with?("n") }, "meeting", only: only) || {}
    round.merge(meeting).presence
  end
end
