# Copies what Stripe knows onto the group: its premium subscription (paid until when) and whether
# its own Stripe account can take contributions yet. Used by StripeWebhooksController and the
# Plan page's refresh.
module StripeSync
  module_function

  def subscription(group, sub = nil)
    sub ||= StripeGateway.subscription(group.stripe_subscription_id)
    period_end = sub.items&.data&.first&.current_period_end
    group.update!(
      stripe_subscription_id: sub.id, subscription_status: sub.status,
      stripe_customer_id: group.stripe_customer_id || sub.customer,
      plan: group.plan == "waived" ? "waived" : (%w[active trialing past_due].include?(sub.status) ? "premium" : "free"),
      premium_until: period_end ? [Time.zone.at(period_end), group.premium_until].compact.max : group.premium_until,
    )
  end

  def account(group, acct = nil)
    acct ||= StripeGateway.account(group.stripe_account_id)
    group.update!(stripe_account_ready: !!(acct.charges_enabled && acct.details_submitted))
  end
end
