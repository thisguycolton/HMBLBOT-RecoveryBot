# A HostDeck of its own, not a meeting's: a business meeting's, host and co-host onboarding, an
# event's day, or anything a group runs from one of its documents (its script). Where its blocks go is
# `arrangement` (DeckArrangement; nil is its purpose's template, in the page). It's run like a
# meeting: a HostingSession for each date, which is its live state and what it keeps.
class Deck < ApplicationRecord
  PURPOSES = %w[business_meeting onboarding event general].freeze

  belongs_to :group
  belongs_to :script_document, class_name: "GroupDocument", optional: true
  belongs_to :created_by, class_name: "User", optional: true
  has_many :sessions, class_name: "HostingSession", dependent: :delete_all

  before_validation { self.name = name.to_s.squish.first(120) }
  before_validation { self.purpose = "general" unless PURPOSES.include?(purpose) }
  before_validation { self.arrangement = DeckArrangement.normalize(arrangement) }

  validates :name, presence: true
  validate { errors.add(:script_document, "isn't one of this group's") if script_document && script_document.group_id != group_id }

  # Today's session (the group's date), made the first time someone opens it
  def session_on(day)
    sessions.find_or_create_by!(on: day)
  rescue ActiveRecord::RecordNotUnique
    sessions.find_by!(on: day)
  end

  def as_list_json
    { id: id, name: name, purpose: purpose, script_document_id: script_document_id, path: "/groups/#{group.slug}/decks/#{id}", updated_at: updated_at.iso8601 }
  end
end
