# A 7th Tradition contribution made online to a group's own Stripe account (see
# ContributionsController), recorded from Stripe's webhook. Only the amount and when: who gave
# stays in Stripe, so the group sees totals.
class GroupContribution < ApplicationRecord
  belongs_to :group

  validates :stripe_id, presence: true, uniqueness: true
  validates :amount_cents, numericality: { only_integer: true, greater_than: 0 }

  # Saves one, unless that Stripe object was already counted
  def self.record!(group:, stripe_id:, amount_cents:, recurring: false, received_at: Time.current)
    return if amount_cents.to_i <= 0 || exists?(stripe_id: stripe_id)

    create!(group:, stripe_id:, amount_cents:, recurring:, received_at:)
  rescue ActiveRecord::RecordNotUnique
    nil
  end
end
