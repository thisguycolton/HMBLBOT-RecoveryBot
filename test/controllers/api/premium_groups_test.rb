require "test_helper"
require "minitest/mock"

class Api::PremiumGroupsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV.to_h.slice("ADMIN_EMAILS", "PREMIUM_ENFORCED", "STRIPE_SECRET_KEY")
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    ENV["PREMIUM_ENFORCED"] = "1"
    ENV["STRIPE_SECRET_KEY"] = "sk_test_123"
    @boss = User.create!(email: "boss@example.com", name: "Boss", password: "password123", confirmed: true, admin: true)
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @treasurer = User.create!(email: "treasurer@example.com", name: "Tess", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @treasurer, role: "member", can_keep_treasury: true)
    @group.memberships.create!(user: @member, role: "member")
  end

  teardown do
    %w[ADMIN_EMAILS PREMIUM_ENFORCED STRIPE_SECRET_KEY].each { |k| @env.key?(k) ? ENV[k] = @env[k] : ENV.delete(k) }
  end

  def body = response.parsed_body
  def billing(*rest) = ["/api/groups/#{@group.slug}/billing", *rest].join("/")
  def lapse! = @group.update!(premium_until: 2.months.ago)

  test "a new group tries premium, then keeps reading but can't write once it lapses" do
    assert_equal "trial", @group.premium_state
    assert @group.premium?
    sign_in @leader
    post "/api/groups/#{@group.slug}/service_positions", params: { service_position: { title: "Secretary" } }, as: :json
    assert_response :created

    lapse!
    assert_equal "free", @group.reload.premium_state
    post "/api/groups/#{@group.slug}/service_positions", params: { service_position: { title: "GSR" } }, as: :json
    assert_response :payment_required
    assert body["premium_required"]
    get "/api/groups/#{@group.slug}/service_positions", as: :json
    assert_response :success
    assert_equal ["Secretary"], body["positions"].map { |p| p["title"] }
    get "/api/groups/#{@group.slug}", as: :json
    assert_equal false, body["premium"]
  end

  test "nothing is locked until premium is enforced, and the grace period keeps it working" do
    lapse!
    ENV.delete("PREMIUM_ENFORCED")
    assert @group.reload.premium?
    ENV["PREMIUM_ENFORCED"] = "1"
    @group.update!(premium_until: 10.days.ago)
    assert_equal "grace", @group.premium_state
    assert @group.premium?
    @group.update!(plan: "waived", premium_until: nil)
    assert @group.premium?
  end

  test "admins and the treasurer see the plan; only admins pay" do
    sign_in @member
    get billing, as: :json
    assert_response :forbidden

    sign_in @treasurer
    get billing, as: :json
    assert_response :success
    assert_equal "trial", body["state"]
    assert_equal 6000, body["price_cents"]
    assert_equal false, body["can_pay"]
    post billing("checkout"), as: :json
    assert_response :forbidden

    sign_in @leader
    StripeGateway.stub(:premium_checkout_url, ->(group:, user:, **) { "https://checkout.stripe.test/#{group.slug}/#{user.name}" }) do
      post billing("checkout"), as: :json
    end
    assert_response :success
    assert_equal "https://checkout.stripe.test/#{@group.slug}/Lee", body["url"]
  end

  test "site admins can waive premium or give a year; others can't" do
    sign_in @leader
    patch billing, params: { billing: { plan: "waived" } }, as: :json
    assert_equal "free", @group.reload.plan

    sign_in @boss
    patch billing, params: { billing: { plan: "waived" } }, as: :json
    assert_equal "waived", body["state"]
    lapse!
    patch billing, params: { billing: { plan: "free", gift_year: true } }, as: :json
    assert_equal "trial", body["state"]
    assert_in_delta 1.year.from_now, @group.reload.premium_until, 1.minute
  end

  test "connecting the group's own Stripe account, and only with premium" do
    sign_in @treasurer
    StripeGateway.stub(:create_group_account, ->(group:, email:) { Stripe::Account.construct_from(id: "acct_123", email:) }) do
      StripeGateway.stub(:onboarding_url, ->(account_id:, **) { "https://connect.stripe.test/#{account_id}" }) do
        post billing("connect"), as: :json
      end
    end
    assert_response :success
    assert_equal "https://connect.stripe.test/acct_123", body["url"]
    assert_equal "acct_123", @group.reload.stripe_account_id
    refute @group.takes_contributions?

    lapse!
    post billing("connect"), as: :json
    assert_response :payment_required
  end

  test "webhooks: premium paid, the account ready, contributions counted once" do
    stripe_event = lambda do |hash|
      ->(*) { Stripe::Event.construct_from(hash) }
    end
    period_end = 1.year.from_now.to_i
    sub = { id: "sub_1", object: "subscription", customer: "cus_1", status: "active", items: { data: [{ current_period_end: period_end }] } }

    StripeGateway.stub(:construct_event, stripe_event.call(type: "checkout.session.completed", data: { object: { object: "checkout.session", mode: "subscription", client_reference_id: @group.id.to_s, metadata: { group_id: @group.id.to_s }, customer: "cus_1", subscription: "sub_1" } })) do
      StripeGateway.stub(:subscription, Stripe::Subscription.construct_from(sub)) do
        post "/stripe/webhooks", params: "{}", headers: { "Stripe-Signature" => "t=1,v1=x" }
      end
    end
    assert_response :ok
    @group.reload
    assert_equal "premium", @group.premium_state
    assert_equal Time.zone.at(period_end).to_i, @group.premium_until.to_i

    StripeGateway.stub(:construct_event, stripe_event.call(type: "customer.subscription.deleted", data: { object: sub.merge(status: "canceled") })) do
      post "/stripe/webhooks", params: "{}"
    end
    assert_equal "free", @group.reload.plan

    @group.update!(stripe_account_id: "acct_9")
    StripeGateway.stub(:construct_event, stripe_event.call(type: "account.updated", account: "acct_9", data: { object: { object: "account", id: "acct_9", charges_enabled: true, details_submitted: true } })) do
      post "/stripe/webhooks", params: "{}"
    end
    assert @group.reload.takes_contributions?

    paid = { type: "checkout.session.completed", account: "acct_9", data: { object: { object: "checkout.session", id: "cs_1", mode: "payment", payment_status: "paid", amount_total: 500 } } }
    2.times do
      StripeGateway.stub(:construct_event, stripe_event.call(paid)) { post "/stripe/webhooks", params: "{}" }
    end
    StripeGateway.stub(:construct_event, stripe_event.call(type: "invoice.paid", account: "acct_9", data: { object: { object: "invoice", id: "in_1", amount_paid: 1000 } })) do
      post "/stripe/webhooks", params: "{}"
    end
    assert_equal [500, 1000], @group.contributions.order(:amount_cents).pluck(:amount_cents)
    assert_equal [false, true], @group.contributions.order(:amount_cents).pluck(:recurring)
  end

  test "a webhook with a bad signature is refused" do
    ENV["STRIPE_WEBHOOK_SECRET"] = "whsec_test"
    post "/stripe/webhooks", params: "{}", headers: { "Stripe-Signature" => "t=1,v1=nope" }
    assert_response :bad_request
  ensure
    ENV.delete("STRIPE_WEBHOOK_SECRET")
  end

  test "the contribution page: only by its link, only when set up, straight to the group's Checkout" do
    get "/g/NOPE22"
    assert_redirected_to "/groups/meetings"

    @group.update!(stripe_account_id: "acct_9", stripe_account_ready: true)
    path = @group.contribution_path
    get path
    assert_response :success
    assert_includes response.body, "Sunrise Crew"
    assert_equal "noindex, nofollow", response.headers["X-Robots-Tag"]

    seen = nil
    StripeGateway.stub(:contribution_checkout_url, ->(group:, cents:, monthly:, **) { seen = [group.id, cents, monthly]; "https://checkout.stripe.test/give" }) do
      post path, params: { amount: "0.50" }.merge(human_check_params)
      assert_response :unprocessable_entity
      post path, params: { amount: "5" }
      assert_response :unprocessable_entity
      post path, params: { amount: "$5", cover_fee: "1", monthly: "1" }.merge(human_check_params)
    end
    assert_redirected_to "https://checkout.stripe.test/give"
    assert_equal [@group.id, 546, true], seen

    get "/api/groups/#{@group.slug}", as: :json
    assert_nil response.parsed_body["contribution_url"]
    sign_in @leader
    get "/api/groups/#{@group.slug}", as: :json
    assert_equal "http://www.example.com#{path}", response.parsed_body["contribution_url"]

    lapse!
    get path
    assert_redirected_to "/groups/meetings"
  end

  test "covering the card fee leaves the group the whole amount" do
    [100, 500, 2000, 10_000].each do |cents|
      gross = ContributionsController.with_fee(cents)
      assert_operator gross - (gross * 0.029 + 30).round, :>=, cents
      assert_operator gross - (gross * 0.029 + 30).round, :<=, cents + 1
    end
  end
end
