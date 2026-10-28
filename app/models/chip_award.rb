# A round chip a group's host gave someone (Api::ChipAwardsController), in that group's chip
# design. Given to a member or an email address: an address with an account gets it at once
# (and a notification); any other gets an email with a link to claim it (ChipsController#claim),
# and it's theirs when they open it signed in, or confirm an account made with that address.
class ChipAward < ApplicationRecord
  ROUND_KEYS = ChipDesign::ROUND_KEYS
  LABELS = { "24h" => "24 hours", "30d" => "30 days", "60d" => "60 days", "90d" => "90 days", "6m" => "6 months", "9m" => "9 months", "18m" => "18 months" }.freeze

  belongs_to :group
  belongs_to :given_by, class_name: "User", optional: true
  belongs_to :user, optional: true

  scope :claimed, -> { where.not(claimed_at: nil) }
  scope :unclaimed, -> { where(claimed_at: nil) }

  before_validation { self.email = email.to_s.strip.downcase }
  before_validation { self.claim_token ||= SecureRandom.urlsafe_base64(24) }
  before_validation { self.years = nil unless milestone_key == "year" }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP, message: "doesn't look like an email address" }
  validates :milestone_key, inclusion: { in: ROUND_KEYS }
  validates :years, numericality: { only_integer: true, in: 1..99 }, if: -> { milestone_key == "year" }
  validates :note, length: { maximum: 500 }
  validate { errors.add(:on, "can't be in the future") if on && on > Date.current + 1 }

  def label = milestone_key == "year" ? "#{years} year#{'s' unless years == 1}" : LABELS[milestone_key]
  def slot = Chips.round_slot(milestone_key, years)
  def claimed? = claimed_at.present?

  # Theirs now: a notification says who gave it
  def claim!(account)
    update!(user: account, claimed_at: Time.current)
    Notification.deliver(account, kind: "chip.given", title: "#{given_by&.display_name || group.title} gave you a #{label} chip",
                                  body: note.presence || "From #{group.title}", url: "/recovery?chip=award:#{id}")
  end

  # An account confirmed with an address chips were sent to
  def self.claim_for(user)
    unclaimed.where(email: user.email.to_s.downcase).find_each { |a| a.claim!(user) }
  end

  def logo_url = group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(group.logo, only_path: true) : nil

  def as_chip_json
    { id: "award:#{id}", slot: slot, shape: "round", kind: "round", label: label, on: on.iso8601, source: "given",
      milestone: { key: milestone_key, years: years, label: label }.compact, design: ChipDesign.for_group(group),
      group: { title: group.title, logo_url: logo_url }, given_by: given_by&.display_name, note: note.presence }
  end

  # For the giver's list
  def as_api_json
    { id: id, label: label, on: on.iso8601, note: note, email: user ? nil : email, to: user&.display_name || email,
      claimed: claimed?, group_slug: group.slug, group_title: group.title, given_by: given_by&.display_name, created_at: created_at.iso8601 }
  end
end
