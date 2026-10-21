# Plan & contributions in the group dashboard: the group's premium (Premium) and its online 7th
# Tradition contributions through its own Stripe account (StripeGateway).
#
# Group admins pay for premium. Admins and treasurers connect the group's Stripe account and see
# the totals. Site admins can give a group premium for good, or a year of it.
class Api::GroupBillingController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_treasurer
  before_action :require_manager, only: %i[checkout portal]
  before_action :require_stripe, only: %i[checkout portal connect]
  before_action :require_premium, only: :connect

  # GET /api/groups/:group_slug/billing
  def show
    render json: billing_json
  end

  # POST /api/groups/:group_slug/billing/checkout -> { url } of Stripe Checkout for a year
  def checkout
    return render(json: { error: "#{@group.title} already has premium. Use Manage billing to change it." }, status: :unprocessable_entity) if @group.subscribed?

    url = StripeGateway.premium_checkout_url(group: @group, user: current_user,
                                             success_url: "#{dashboard_url}?paid=1", cancel_url: dashboard_url)
    render json: { url: }
  rescue Stripe::StripeError => e
    stripe_failed(e)
  end

  # POST /api/groups/:group_slug/billing/portal -> { url } of Stripe's billing page
  def portal
    return render(json: { error: "There's no billing to manage yet." }, status: :unprocessable_entity) if @group.stripe_customer_id.blank?

    render json: { url: StripeGateway.billing_portal_url(group: @group, return_url: dashboard_url) }
  rescue Stripe::StripeError => e
    stripe_failed(e)
  end

  # POST /api/groups/:group_slug/billing/connect -> { url } of Stripe's sign-up for the group's
  # own account (made the first time), or back to it to finish
  def connect
    if @group.stripe_account_id.blank?
      account = StripeGateway.create_group_account(group: @group, email: current_user.email)
      @group.update!(stripe_account_id: account.id, stripe_account_ready: false)
    end
    render json: { url: StripeGateway.onboarding_url(account_id: @group.stripe_account_id,
                                                     refresh_url: "#{dashboard_url}?connect=again", return_url: "#{dashboard_url}?connect=back") }
  rescue Stripe::StripeError => e
    stripe_failed(e)
  end

  # POST /api/groups/:group_slug/billing/refresh: asks Stripe again (after coming back from it)
  def refresh
    if Premium.stripe_configured?
      StripeSync.account(@group) if @group.stripe_account_id.present?
      StripeSync.subscription(@group) if @group.stripe_subscription_id.present?
    end
    render json: billing_json
  rescue Stripe::StripeError => e
    stripe_failed(e)
  end

  # PATCH /api/groups/:group_slug/billing { contribution_note } (admins and treasurers), and for
  # site admins { plan: "free" | "waived" } or { gift_year: true }
  def update
    attrs = params.fetch(:billing, {}).permit(:contribution_note).to_h
    if current_user.suite_admin?
      plan = params.dig(:billing, :plan)
      attrs[:plan] = plan if %w[free waived].include?(plan)
      attrs[:premium_until] = [@group.premium_until, Time.current].compact.max + 1.year if ActiveModel::Type::Boolean.new.cast(params.dig(:billing, :gift_year))
    end
    return render_errors(@group) unless @group.update(attrs)

    render json: billing_json
  end

  private

  def require_treasurer
    return if @group.treasury_editable_by?(current_user)

    render json: { error: "Only this group's admins and treasurer can see that." }, status: :forbidden
  end

  def require_stripe
    return if Premium.stripe_configured?

    render json: { error: "Payments aren't set up on RecoveryBot yet." }, status: :service_unavailable
  end

  def stripe_failed(error)
    Rails.logger.error("Stripe (group #{@group.id}): #{error.class}: #{error.message}")
    render json: { error: "Stripe didn't take that: #{error.message}" }, status: :bad_gateway
  end

  def dashboard_url = "#{request.base_url}/groups/#{@group.slug}/conscience/plan"

  def billing_json
    year = @group.contributions.where(received_at: Time.current.beginning_of_year..)
    month = year.where(received_at: Time.current.beginning_of_month..)
    {
      state: @group.premium_state, premium: @group.premium?, enforced: Premium.enforced?,
      premium_until: @group.premium_until&.iso8601, grace_until: @group.premium_until&.then { |t| (t + Premium::GRACE).iso8601 },
      subscribed: @group.subscribed?, subscription_status: @group.subscription_status, has_billing: @group.stripe_customer_id.present?,
      price_cents: Premium.price_cents, stripe_configured: Premium.stripe_configured?,
      can_pay: @group.manageable_by?(current_user), is_site_admin: current_user.suite_admin?, plan: @group.plan,
      contributions: {
        connected: @group.stripe_account_id.present?, ready: @group.stripe_account_ready, live: @group.takes_contributions?,
        url: @group.takes_contributions? ? "#{request.base_url}#{@group.contribution_path}" : nil,
        note: @group.contribution_note,
        month_cents: month.sum(:amount_cents), month_count: month.count,
        year_cents: year.sum(:amount_cents), year_count: year.count,
        monthly_givers: @group.contributions.where(recurring: true, received_at: 35.days.ago..).count,
      },
    }
  end
end
