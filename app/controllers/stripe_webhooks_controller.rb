# POST /stripe/webhooks: what Stripe tells us. Two endpoints in Stripe point here, each with its
# own secret: one for RecoveryBot's account (STRIPE_WEBHOOK_SECRET: premium subscriptions) and
# one for connected accounts (STRIPE_CONNECT_WEBHOOK_SECRET: the groups' contributions and
# whether their accounts are ready).
class StripeWebhooksController < ActionController::Base
  skip_forgery_protection

  def create
    event = StripeGateway.construct_event(request.body.read, request.headers["Stripe-Signature"])
    handle(event)
    head :ok
  rescue JSON::ParserError, Stripe::SignatureVerificationError => e
    Rails.logger.warn("Stripe webhook refused: #{e.message}")
    head :bad_request
  end

  private

  def handle(event)
    object = event.data.object
    if event.respond_to?(:account) && event.account.present?
      connected(event, object, Group.find_by(stripe_account_id: event.account))
    else
      platform(event, object)
    end
  end

  # Premium, on RecoveryBot's own account
  def platform(event, object)
    case event.type
    when "checkout.session.completed"
      group = Group.find_by(id: object.metadata&.[](:group_id) || object.client_reference_id)
      return unless group && object.mode == "subscription"

      group.update!(stripe_customer_id: object.customer, stripe_subscription_id: object.subscription)
      StripeSync.subscription(group)
    when "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"
      group = Group.find_by(stripe_subscription_id: object.id) || Group.find_by(stripe_customer_id: object.customer)
      StripeSync.subscription(group, object) if group
    when "invoice.paid", "invoice.payment_failed"
      group = Group.find_by(stripe_customer_id: object.customer)
      StripeSync.subscription(group) if group&.stripe_subscription_id.present?
    end
  end

  # A group's own account: contributions (amounts only) and whether it's ready
  def connected(event, object, group)
    return unless group

    case event.type
    when "account.updated"
      StripeSync.account(group, object)
    when "checkout.session.completed"
      return unless object.mode == "payment" && object.payment_status == "paid"

      GroupContribution.record!(group:, stripe_id: object.id, amount_cents: object.amount_total)
    when "invoice.paid"
      # A monthly contribution, the first month and each one after
      GroupContribution.record!(group:, stripe_id: object.id, amount_cents: object.amount_paid, recurring: true)
    end
  end
end
