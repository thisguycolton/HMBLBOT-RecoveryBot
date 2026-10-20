require "resolv"

# The card a note shows for its first link: the page's title, description, site name and
# picture, from its Open Graph / Twitter tags or <title>. Fetched by our server while the
# note is written (Api::LinkPreviewsController) and again when it's saved (cached a day),
# so readers' browsers never contact the other site; its picture is copied onto the note.
#
# Only public http(s) addresses are fetched: every hop of a redirect is checked and the
# connection goes to the address that was checked, so a link can't reach our own network.
class LinkPreview
  HTML_MAX = 1.megabyte
  IMAGE_MAX = 5.megabytes
  REDIRECTS_MAX = 3
  TIMEOUT = 4
  USER_AGENT = "RecoveryBot link preview (+https://recoverybot.hmblbot.com)"
  IMAGE_TYPES = %w[image/jpeg image/png image/webp image/gif].freeze

  class Blocked < StandardError; end

  # { url:, title:, description:, site_name:, image_url: } or nil when there's nothing to show
  def self.fetch(url)
    url = normalize(url)
    return unless url

    Rails.cache.fetch(["link_preview", 1, url], expires_in: 1.day, skip_nil: true) { new.fetch(url) }
  end

  # The picture at `url` as { io:, filename:, content_type: } for Active Storage, or nil
  def self.image(url) = new.image(url)

  def self.normalize(url)
    uri = URI.parse(url.to_s.strip)
    uri.to_s if %w[http https].include?(uri.scheme) && uri.host.present? && url.to_s.length <= 2_000
  rescue URI::InvalidURIError
    nil
  end

  def fetch(url)
    response, body, final = get(url, accept: "text/html,application/xhtml+xml", max: HTML_MAX)
    return unless response&.content_type.to_s.match?(%r{html}i)

    doc = Nokogiri::HTML(body.force_encoding("UTF-8").scrub)
    meta = ->(*names) { names.lazy.map { |n| doc.at_css(%(meta[property="#{n}"], meta[name="#{n}"]))&.[]("content") }.find(&:present?) }
    title = meta.call("og:title", "twitter:title") || doc.at_css("title")&.text
    return if title.blank?

    image = meta.call("og:image", "og:image:url", "twitter:image")
    image = (URI.join(final, image).to_s rescue nil) if image
    {
      url: url,
      title: clean(title, 200),
      description: clean(meta.call("og:description", "twitter:description", "description"), 300),
      site_name: clean(meta.call("og:site_name"), 80) || URI.parse(final).host.delete_prefix("www."),
      image_url: (image if self.class.normalize(image)),
    }
  rescue Blocked, Timeout::Error, SystemCallError, SocketError, OpenSSL::SSL::SSLError, Net::HTTPBadResponse, URI::Error, IOError
    nil
  end

  def image(url)
    url = self.class.normalize(url)
    return unless url

    response, body = get(url, accept: IMAGE_TYPES.join(","), max: IMAGE_MAX)
    type = response&.content_type.to_s.downcase
    return unless IMAGE_TYPES.include?(type) && body.present?

    { io: StringIO.new(body), filename: "link-preview.#{type.split('/').last}", content_type: type }
  rescue Blocked, Timeout::Error, SystemCallError, SocketError, OpenSSL::SSL::SSLError, Net::HTTPBadResponse, URI::Error, IOError
    nil
  end

  private

  # [response, body, final url] following redirects, or nil. Bodies over `max` are refused.
  def get(url, accept:, max:)
    REDIRECTS_MAX.succ.times do
      uri = URI.parse(url)
      raise Blocked unless %w[http https].include?(uri.scheme)

      response, body = request(uri, accept, max)
      return [response, body, url] unless response.is_a?(Net::HTTPRedirection)

      url = URI.join(url, response["location"].to_s).to_s
    end
    nil
  end

  def request(uri, accept, max)
    # Straight to the checked address: no proxy, which would look the name up again
    http = Net::HTTP.new(uri.host, uri.port, nil)
    http.ipaddr = public_address(uri.host)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = http.read_timeout = http.ssl_timeout = TIMEOUT
    body = +""
    http.start do
      req = Net::HTTP::Get.new(uri.request_uri, "User-Agent" => USER_AGENT, "Accept" => accept)
      response = http.request(req) do |res|
        next unless res.is_a?(Net::HTTPSuccess)

        res.read_body do |chunk|
          body << chunk
          raise Blocked if body.bytesize > max
        end
      end
      [response, body]
    end
  end

  # The host's first address, if it's on the public internet
  def public_address(host)
    address = Resolv.getaddresses(host).first or raise Blocked
    ip = IPAddr.new(address)
    raise Blocked if ip.private? || ip.loopback? || ip.link_local? || BLOCKED.any? { |range| range.include?(ip) }

    address
  end

  BLOCKED = %w[0.0.0.0/8 100.64.0.0/10 192.0.0.0/24 198.18.0.0/15 224.0.0.0/3 ::/128 ::ffff:0:0/96 64:ff9b::/96 ff00::/8].map { |r| IPAddr.new(r) }.freeze

  def clean(text, max)
    text = text.to_s.gsub(/\s+/, " ").strip
    CGI.unescapeHTML(text).truncate(max) if text.present?
  end
end
