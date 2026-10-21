# GET /g/:code: a group's 7th Tradition page, the short link its hosts share in the meeting
# (Group#contribution_path). It's never listed on the group's public page or in Find a meeting:
# A.A. groups are self-supporting through their own members' contributions. No account needed.
#
# POST /g/:code sends the member to Stripe Checkout on the group's own Stripe account, so the
# money goes straight to the group and RecoveryBot takes no cut.
class ContributionsController < ApplicationController
  layout "reader"
  MIN_CENTS = 1_00
  MAX_CENTS = 1_000_00
  PRESETS = [2_00, 5_00, 10_00, 20_00].freeze
  # Stripe's US card fee, for "cover the card fee"
  FEE_PERCENT = 0.029
  FEE_FIXED = 30

  before_action :set_group
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }
  rate_limit to: 10, within: 10.minutes, only: :create, with: -> { show_page("Please wait a few minutes and try again.", status: :too_many_requests) }

  def show
    show_page
  end

  def create
    return show_page("That didn't look like a person. Please try again.") unless HumanCheck.passed?(params, remote_ip: request.remote_ip)

    cents = (params[:amount].to_s.delete("$,").to_d * 100).round.to_i
    return show_page("Please choose an amount from $1 to $1,000.") unless cents.between?(MIN_CENTS, MAX_CENTS)

    cents = self.class.with_fee(cents) if params[:cover_fee] == "1"
    url = StripeGateway.contribution_checkout_url(group: @group, cents:, monthly: params[:monthly] == "1",
                                                  success_url: "#{page_url}?thanks=1", cancel_url: page_url)
    redirect_to url, allow_other_host: true, status: :see_other
  rescue Stripe::StripeError => e
    Rails.logger.error("Contribution checkout (group #{@group.id}): #{e.class}: #{e.message}")
    show_page("Stripe couldn't start that just now. Please try again in a minute.")
  end

  # What to charge so the group gets `cents` after Stripe's card fee
  def self.with_fee(cents) = ((cents + FEE_FIXED) / (1 - FEE_PERCENT)).ceil

  private

  def set_group
    @group = Group.find_by_contribution_code(params[:code])
    return if @group&.active? && @group.takes_contributions?

    redirect_to "/groups/meetings", alert: "That contribution link isn't working. Check it with your group's treasurer."
  end

  def page_url = "#{request.base_url}/g/#{@group.contribution_code}"

  def show_page(*errors, status: nil)
    @props = {
      action: "/g/#{@group.contribution_code}", authenticity_token: form_authenticity_token,
      group: { title: @group.title, slug: @group.slug, note: @group.contribution_note,
               logo_url: @group.logo.attached? ? rails_storage_proxy_path(@group.logo, only_path: true) : nil },
      presets: PRESETS, min_cents: MIN_CENTS, max_cents: MAX_CENTS, fee: { percent: FEE_PERCENT, fixed: FEE_FIXED },
      thanks: params[:thanks].present?, errors: errors,
      values: { amount: params[:amount], monthly: params[:monthly] == "1", cover_fee: params[:cover_fee] == "1" },
      human_check: HumanCheck.fields,
    }
    render :show, status: status || (errors.any? ? :unprocessable_entity : :ok)
  end
end
