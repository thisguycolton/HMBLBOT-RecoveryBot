# A HostDeck of its own, not a meeting's: a business meeting's, host and co-host onboarding, an
# event's day, or anything a group runs from one of its documents (its script). Where its blocks go is
# `arrangement` (DeckArrangement; nil is its purpose's template, in the page). It's run like a
# meeting: a HostingSession for each date, which is its live state and what it keeps.
class Deck < ApplicationRecord
  PURPOSES = %w[business_meeting onboarding event general].freeze
  # What people without an account may do with the share link: nothing (the link only brings
  # members to the deck), or follow the deck read-only, as the hosts move through it
  GUEST_ACCESS = %w[off view].freeze

  belongs_to :group
  belongs_to :script_document, class_name: "GroupDocument", optional: true
  belongs_to :created_by, class_name: "User", optional: true
  has_many :sessions, class_name: "HostingSession", dependent: :delete_all

  before_validation { self.name = name.to_s.squish.first(120) }
  before_validation { self.purpose = "general" unless PURPOSES.include?(purpose) }
  before_validation { self.intro_title = intro_title.to_s.squish.first(80).presence }
  before_validation { self.arrangement = DeckArrangement.normalize(arrangement) }
  before_validation { self.guest_access = "off" unless GUEST_ACCESS.include?(guest_access) }
  before_validation(on: :create) { self.share_code ||= HostingSession.new_code }

  validates :name, presence: true
  validate { errors.add(:script_document, "isn't one of this group's") if script_document && script_document.group_id != group_id }

  def guest_view? = guest_access == "view"
  def share_path = "/h/#{share_code!}"

  # The link's code (decks from before sharing get one the first time it's asked for)
  def share_code!
    update_column(:share_code, HostingSession.new_code) if share_code.blank? && persisted?
    share_code
  end

  # A new link: the old one stops working
  def reshare! = update!(share_code: HostingSession.new_code)

  def self.find_by_share_code(code) = find_by(share_code: code.to_s.upcase.gsub(/[^A-Z0-9]/, "").presence)

  # Today's session (the group's date), made the first time someone opens it
  def session_on(day)
    sessions.find_or_create_by!(on: day)
  rescue ActiveRecord::RecordNotUnique
    sessions.find_by!(on: day)
  end

  # `documents`: the titles of the scripts this viewer may see, by id (a deck run from a document
  # only its keepers see doesn't give its title away)
  def as_list_json(documents: {})
    { id: id, name: name, purpose: purpose, script_document_id: script_document_id, path: "/groups/#{group.slug}/decks/#{id}", updated_at: updated_at.iso8601,
      script_document: (documents[script_document_id] && { id: script_document_id, title: documents[script_document_id] }) }
  end
end
