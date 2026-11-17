# Notifications for the signed-in account's devices (account settings > Notifications on this
# device, components/profile/PushSettings.jsx):
# - browsers and home-screen apps: Web Push. The browser makes the subscription with the VAPID
#   public key from #index and posts it here; WebPushSender sends every new Notification to it.
# - the iPhone and Android apps: Firebase Cloud Messaging. The app posts its token (#app_create);
#   FcmSender sends to it. Both kinds are listed together as the account's devices.
class Api::PushSubscriptionsController < ApplicationController
  before_action :authenticate_user!, except: %i[destroy renew app_destroy]
  # The service worker has no CSRF token; renewing needs the old endpoint, which only that browser knows
  skip_forgery_protection only: :renew

  # GET /api/push_subscriptions?endpoint=...|token=... -> { available, app_available, public_key, devices: [...], categories: [...] }
  def index
    render json: state_json
  end

  # POST /api/push_subscriptions { subscription: { endpoint, keys: { p256dh, auth } } }
  # The same browser signing in to another account moves its subscription there.
  def create
    return render(json: { error: "Notifications aren't set up on this site yet." }, status: :unprocessable_entity) unless WebPushSender.configured?

    sub = PushSubscription.find_or_initialize_by(endpoint: endpoint_param)
    sub.assign_attributes(user: current_user, p256dh: key_param(:p256dh), auth: key_param(:auth), user_agent: request.user_agent.to_s.truncate(255))
    return render(json: { error: sub.errors.full_messages.to_sentence }, status: :unprocessable_entity) unless sub.save

    render json: state_json(sub.endpoint), status: :created
  end

  # POST /api/push_subscriptions/app { token, platform, app_version }: this app install's Firebase
  # token. The same phone signing in to another account moves it there.
  def app_create
    return render(json: { error: "Notifications aren't set up for the app yet." }, status: :unprocessable_entity) unless FcmSender.configured?

    device = DeviceToken.find_or_initialize_by(token: params[:token].to_s)
    device.assign_attributes(user: current_user, platform: params[:platform].to_s, app_version: params[:app_version].to_s.truncate(40).presence)
    return render(json: { error: device.errors.full_messages.to_sentence }, status: :unprocessable_entity) unless device.save

    render json: state_json(token: device.token), status: :created
  end

  # DELETE /api/push_subscriptions/app { token }: this app turning notifications off, or logged out
  def app_destroy
    DeviceToken.where(token: params[:token].to_s).destroy_all if params[:token].present?
    user_signed_in? ? render(json: state_json) : head(:no_content)
  end

  # DELETE /api/push_subscriptions { endpoint } (this browser turning it off, or signed out),
  # or DELETE /api/push_subscriptions/:id (one of your devices, from settings; "app-12" for an app)
  def destroy
    if params[:id].present?
      return head(:unauthorized) unless user_signed_in?

      if params[:id].to_s.start_with?("app-")
        current_user.device_tokens.find(params[:id].to_s.delete_prefix("app-")).destroy
      else
        current_user.push_subscriptions.find(params[:id]).destroy
      end
    else
      PushSubscription.where(endpoint: endpoint_param).destroy_all if endpoint_param.present?
    end
    user_signed_in? ? render(json: state_json(params[:current_endpoint])) : head(:no_content)
  end

  # PATCH /api/push_subscriptions/categories { key, on }: which kinds of notification are pushed
  # (Notification::PUSH_CATEGORIES); for every device on the account
  def categories
    key = params[:key].to_s
    return head(:unprocessable_entity) unless current_user.push_categories.any? { |c| c[:key] == key }

    off = ActiveModel::Type::Boolean.new.cast(params[:on]) ? current_user.push_off - [key] : current_user.push_off | [key]
    current_user.update_column(:push_off, off)
    render json: state_json
  end

  TEST_TITLE = "Notifications are on".freeze
  TEST_BODY = "This is how RecoveryBot will let you know about your groups and meetings.".freeze

  # POST /api/push_subscriptions/test { endpoint } or { token }: a sample notification to this device
  def test
    if params[:token].present?
      device = current_user.device_tokens.find_by!(token: params[:token].to_s)
      message = { notification: { title: TEST_TITLE, body: TEST_BODY }, data: { url: "/users/edit#notifications", tag: "test" } }
      return head(:no_content) if FcmSender.send_to(device, message)

      return render(json: { error: "Firebase didn't take it. Try turning notifications off and on again." }, status: :bad_gateway)
    end
    sub = current_user.push_subscriptions.find_by!(endpoint: endpoint_param)
    sent = WebPushSender.send_to(sub, { title: TEST_TITLE, body: TEST_BODY,
                                        tag: "test", url: "/users/edit#notifications", unread: current_user.notifications.unread.count })
    return render(json: { error: "Your browser's push service didn't take it. Try turning notifications off and on again." }, status: :bad_gateway) unless sent

    head :no_content
  end

  # POST /api/push_subscriptions/renew { old_endpoint, subscription: {...} }: the browser
  # replaced its subscription (the service worker's pushsubscriptionchange)
  def renew
    sub = PushSubscription.find_by(endpoint: params[:old_endpoint].to_s)
    return head(:not_found) unless sub

    sub.update(endpoint: endpoint_param, p256dh: key_param(:p256dh), auth: key_param(:auth)) ? head(:no_content) : head(:unprocessable_entity)
  end

  private

  def endpoint_param
    (params.dig(:subscription, :endpoint) || params[:endpoint]).to_s
  end

  def key_param(name)
    params.dig(:subscription, :keys, name).to_s
  end

  def state_json(current = params[:endpoint], token: params[:token] || params[:current_token])
    devices = current_user.push_subscriptions.map { |s| s.as_api_json(current.presence) } +
              current_user.device_tokens.map { |d| d.as_api_json(token.presence) }
    { available: WebPushSender.configured?, app_available: FcmSender.configured?, public_key: WebPushSender.public_key,
      devices: devices.sort_by { |d| d[:created_at] }.reverse,
      categories: current_user.push_categories }
  end
end
