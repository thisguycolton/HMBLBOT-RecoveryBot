# Web Push for the signed-in account's devices (account settings > Notifications on this device,
# components/profile/PushSettings.jsx). The browser makes the subscription with the VAPID public
# key from #index and posts it here; WebPushSender sends every new Notification to it.
class Api::PushSubscriptionsController < ApplicationController
  before_action :authenticate_user!, except: %i[destroy renew]
  # The service worker has no CSRF token; renewing needs the old endpoint, which only that browser knows
  skip_forgery_protection only: :renew

  # GET /api/push_subscriptions?endpoint=... -> { available, public_key, devices: [...] }
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

  # DELETE /api/push_subscriptions { endpoint } (this browser turning it off, or signed out),
  # or DELETE /api/push_subscriptions/:id (one of your devices, from settings)
  def destroy
    if params[:id].present?
      return head(:unauthorized) unless user_signed_in?

      current_user.push_subscriptions.find(params[:id]).destroy
    else
      PushSubscription.where(endpoint: endpoint_param).destroy_all if endpoint_param.present?
    end
    user_signed_in? ? render(json: state_json(params[:current_endpoint])) : head(:no_content)
  end

  # POST /api/push_subscriptions/test { endpoint }: a sample notification to this device
  def test
    sub = current_user.push_subscriptions.find_by!(endpoint: endpoint_param)
    sent = WebPushSender.send_to(sub, { title: "Notifications are on", body: "This is how RecoveryBot will let you know about your groups and meetings.",
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

  def state_json(current = params[:endpoint])
    { available: WebPushSender.configured?, public_key: WebPushSender.public_key,
      devices: current_user.push_subscriptions.order(created_at: :desc).map { |s| s.as_api_json(current.presence) } }
  end
end
