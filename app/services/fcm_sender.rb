require "net/http"

# Sends notifications to the iPhone and Android apps through Firebase Cloud Messaging (the
# HTTP v1 API), beside WebPushSender for browsers. Google passes them to Apple (APNs, with the
# Apple Push Key uploaded to the Firebase project) or to Android itself.
#
# Needs FIREBASE_SERVICE_ACCOUNT: the JSON key of a Firebase service account (Project settings >
# Service accounts > Generate new private key), pasted whole or base64-encoded. Without it the
# apps don't offer notifications and nothing is sent. Setup: mobile/PUSH_SETUP.md.
#
# Unlike Web Push, Firebase sees what's sent (the title and the short line under it), so a
# notification only ever says what the bell says.
module FcmSender
  SCOPE = "https://www.googleapis.com/auth/firebase.messaging".freeze
  TOKEN_URL = "https://oauth2.googleapis.com/token".freeze

  class << self
    def configured? = credentials.present?

    # Every app install the notification's account turned notifications on for, unless they
    # turned that kind off
    def deliver(notification)
      return unless configured? && notification.user.wants_push?(notification.kind)

      message = message_for(notification)
      notification.user.device_tokens.find_each { |device| send_to(device, message) }
    end

    # What a phone shows and what a tap opens (native_app.js reads data.url)
    def message_for(notification)
      tag = "n-#{notification.id}"
      {
        notification: { title: notification.title.to_s, body: notification.body.to_s },
        data: { url: notification.open_path, id: notification.id.to_s, tag: tag },
        android: { priority: "high", notification: { tag: tag, sound: "default" } },
        apns: { headers: { "apns-collapse-id" => tag }, payload: { aps: { sound: "default" } } },
      }
    end

    # true once Firebase takes it; a token Firebase says is gone is deleted
    def send_to(device, message)
      uri = URI("https://fcm.googleapis.com/v1/projects/#{credentials['project_id']}/messages:send")
      res = Net::HTTP.post(uri, { message: message.merge(token: device.token) }.to_json,
                           "Authorization" => "Bearer #{access_token}", "Content-Type" => "application/json")
      if res.is_a?(Net::HTTPSuccess)
        device.update_column(:last_sent_at, Time.current)
        return true
      end
      if gone?(res)
        device.destroy
      else
        @access_token = nil if res.code == "401"
        Rails.logger.warn("[fcm] #{device.id}: #{res.code} #{res.body.to_s.truncate(300)}")
      end
      false
    rescue SocketError, Timeout::Error, SystemCallError, OpenSSL::SSL::SSLError, IOError => e
      Rails.logger.warn("[fcm] #{device.id}: #{e.class} #{e.message.to_s.truncate(200)}")
      false
    end

    # The service account's key, from FIREBASE_SERVICE_ACCOUNT (JSON or base64 JSON)
    def credentials
      raw = ENV["FIREBASE_SERVICE_ACCOUNT"].to_s.strip
      return if raw.empty?

      @credentials = nil if @credentials_raw != raw
      @credentials_raw = raw
      @credentials ||= begin
        json = raw.start_with?("{") ? raw : Base64.decode64(raw)
        parsed = JSON.parse(json)
        parsed if parsed["project_id"].present? && parsed["private_key"].present? && parsed["client_email"].present?
      rescue JSON::ParserError
        nil
      end
    end

    private

    # An unregistered token (the app was removed, or it made a new one) or one that was never valid
    def gone?(res)
      return true if res.code == "404"

      details = JSON.parse(res.body.to_s).dig("error", "details") || []
      details.any? { |d| %w[UNREGISTERED INVALID_ARGUMENT].include?(d["errorCode"]) } && res.body.to_s.include?("token")
    rescue JSON::ParserError
      false
    end

    # An OAuth access token for the service account, good for an hour, kept until near its end
    def access_token
      return @access_token if @access_token && @access_token_until.to_i > Time.now.to_i + 60

      now = Time.now.to_i
      assertion = JWT.encode({ iss: credentials["client_email"], scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
                             OpenSSL::PKey::RSA.new(credentials["private_key"]), "RS256")
      res = Net::HTTP.post_form(URI(TOKEN_URL), grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: assertion)
      raise IOError, "Google's token service said #{res.code}" unless res.is_a?(Net::HTTPSuccess)

      body = JSON.parse(res.body)
      @access_token_until = now + body["expires_in"].to_i
      @access_token = body["access_token"]
    end
  end
end
