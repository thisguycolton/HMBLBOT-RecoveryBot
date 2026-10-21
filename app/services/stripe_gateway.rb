# Every call RecoveryBot makes to Stripe, in one place (and easy to stub in tests).
#
# - Premium: a yearly subscription on RecoveryBot's own account, through Checkout and the
#   Customer Portal.
# - Contributions: each group connects its own Stripe account (full Stripe Dashboard, Stripe sets
#   the fees and covers losses), and members pay the group directly: direct charges with no
#   application fee, so RecoveryBot takes nothing and never holds the money.
module StripeGateway
  module_function

  def client = Stripe::StripeClient.new(ENV.fetch("STRIPE_SECRET_KEY"))

  # Checkout for a year of premium. Returns the page to send the admin to.
  def premium_checkout_url(group:, user:, success_url:, cancel_url:)
    params = {
      mode: "subscription",
      client_reference_id: group.id.to_s,
      metadata: { group_id: group.id.to_s },
      subscription_data: { metadata: { group_id: group.id.to_s } },
      line_items: [{ quantity: 1, price_data: {
        currency: "usd", unit_amount: Premium.price_cents, recurring: { interval: "year" },
        product_data: { name: "RecoveryBot premium group" },
      } }],
      allow_promotion_codes: true,
      success_url:, cancel_url:,
    }
    group.stripe_customer_id.present? ? params[:customer] = group.stripe_customer_id : params[:customer_email] = user.email
    client.v1.checkout.sessions.create(params).url
  end

  # Where an admin changes the card, gets receipts or cancels
  def billing_portal_url(group:, return_url:)
    client.v1.billing_portal.sessions.create({ customer: group.stripe_customer_id, return_url: }).url
  end

  def subscription(id) = client.v1.subscriptions.retrieve(id)

  # The group's own Stripe account. It's the group's: it signs in at stripe.com, and keeps it if
  # it ever leaves RecoveryBot.
  def create_group_account(group:, email:)
    client.v1.accounts.create({
      email: email.presence,
      country: "US",
      business_profile: { name: group.title, product_description: "7th Tradition contributions from the members of #{group.title}" },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      controller: {
        stripe_dashboard: { type: "full" },
        fees: { payer: "account" },
        losses: { payments: "stripe" },
        requirement_collection: "stripe",
      },
      metadata: { group_id: group.id.to_s },
    }.compact)
  end

  def account(id) = client.v1.accounts.retrieve(id)

  # Stripe's own sign-up pages for the account (who the group is, its bank account)
  def onboarding_url(account_id:, refresh_url:, return_url:)
    client.v1.account_links.create({ account: account_id, refresh_url:, return_url:, type: "account_onboarding" }).url
  end

  # Checkout for a contribution, charged on the group's account. monthly: true makes it repeat.
  def contribution_checkout_url(group:, cents:, monthly:, success_url:, cancel_url:)
    price_data = { currency: "usd", unit_amount: cents, product_data: { name: "7th Tradition contribution to #{group.title}" } }
    price_data[:recurring] = { interval: "month" } if monthly
    params = {
      mode: monthly ? "subscription" : "payment",
      line_items: [{ quantity: 1, price_data: }],
      metadata: { group_id: group.id.to_s, kind: "contribution" },
      success_url:, cancel_url:,
    }
    params[:submit_type] = "donate" unless monthly
    client.v1.checkout.sessions.create(params, { stripe_account: group.stripe_account_id }).url
  end

  def construct_event(payload, signature)
    secrets = [ENV["STRIPE_WEBHOOK_SECRET"], ENV["STRIPE_CONNECT_WEBHOOK_SECRET"]].compact_blank
    raise Stripe::SignatureVerificationError.new("No webhook secret set", signature) if secrets.empty?

    secrets.each_with_index do |secret, i|
      return Stripe::Webhook.construct_event(payload, signature, secret)
    rescue Stripe::SignatureVerificationError
      raise if i == secrets.size - 1
    end
  end
end
