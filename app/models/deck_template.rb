# A HostDeck layout saved to start decks from (DeckArrangement): a group's own, and shared to the
# site-wide gallery when the group asks (gallery: pending) and a site admin publishes it. The
# built-in templates (Host a meeting, Business meeting...) are in the page (deck/templates.js).
class DeckTemplate < ApplicationRecord
  moderates_language :name, :description
  PURPOSES = %w[meeting business_meeting onboarding event general].freeze
  GALLERY = %w[none pending published declined].freeze

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :reviewed_by, class_name: "User", optional: true

  before_validation { self.name = name.to_s.squish.first(80) }
  before_validation { self.description = description.to_s.squish.first(300).presence }
  before_validation { self.purpose = "general" unless PURPOSES.include?(purpose) }
  before_validation { self.arrangement = DeckArrangement.normalize(arrangement) || {} }

  validates :name, presence: true
  validates :gallery, inclusion: { in: GALLERY }
  validate { errors.add(:arrangement, "has no blocks") if arrangement.blank? }

  scope :published, -> { where(gallery: "published") }

  def as_api_json
    { id: id, name: name, description: description, purpose: purpose, arrangement: arrangement, gallery: gallery,
      group: { slug: group.slug, title: group.title }, by: created_by&.display_name, updated_at: updated_at.iso8601 }
  end
end
