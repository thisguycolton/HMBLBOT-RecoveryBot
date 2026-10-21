# Premium groups: the group dashboard's business tools (business meetings, decisions, documents,
# elected officials, treasury, the Hosting Command Center) and online 7th Tradition
# contributions. The basics stay free for every group: its page, members and roles, the meeting
# and host schedules, events, approved literature and court verifications.
#
# Nothing is locked until PREMIUM_ENFORCED=1. A group that stops paying keeps everything it
# wrote, readable as before; it just can't add or change premium records (GroupScoped#require_premium).
module Premium
  PRICE_CENTS = 60_00
  TRIAL = 60.days
  GRACE = 30.days

  module_function

  def enforced? = ActiveModel::Type::Boolean.new.cast(ENV["PREMIUM_ENFORCED"]) || false

  # Billing and contributions need Stripe's keys (set in CapRover)
  def stripe_configured? = ENV["STRIPE_SECRET_KEY"].present?

  def price_cents = (ENV["PREMIUM_PRICE_CENTS"].presence || PRICE_CENTS).to_i
end
