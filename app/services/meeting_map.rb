require "net/http"

# A small map of where an in-person meeting is: OpenStreetMap's tiles around it with a pin,
# zoomed out far enough to show the main cross streets, so people can tell where it is and
# open their own maps app for directions. Drawn here with ImageMagick (like ShareCard), so
# visitors' browsers never fetch anything from OpenStreetMap.
#
#   MeetingMap.for(record)   a map for a Meeting or OiaaMeeting with a place, or nil
#   map.path                 the PNG, drawn now if it isn't there yet (raises MeetingMap::Failed)
#
# Where it is comes from the record's latitude/longitude (meeting lists' feeds have them),
# else its address looked up once with Nominatim, OpenStreetMap's geocoder, and saved.
#
# OpenStreetMap's tile and Nominatim policies ask for a real User-Agent, caching, and at
# most one lookup a second: tiles are kept in tmp/map_tiles for TILE_DAYS, maps in
# tmp/meeting_maps, misses are remembered, and lookups wait their turn. MAP_TILE_URL and
# GEOCODER_URL point them elsewhere.
class MeetingMap
  VERSION = 1
  ZOOM = 15
  WIDTH = 720
  HEIGHT = 360
  TILE = 256
  TILE_DAYS = 14
  DIR = Rails.root.join("tmp/meeting_maps")
  TILE_DIR = Rails.root.join("tmp/map_tiles")
  ASSETS = ShareCard::ASSETS
  USER_AGENT = OiaaFeed::USER_AGENT
  ATTRIBUTION = "© OpenStreetMap contributors"

  class Failed < StandardError; end

  attr_reader :latitude, :longitude

  def self.tile_url = ENV["MAP_TILE_URL"].presence || "https://tile.openstreetmap.org/%<z>d/%<x>d/%<y>d.png"
  def self.geocoder_url = ENV["GEOCODER_URL"].presence || "https://nominatim.openstreetmap.org/search"

  # The record's map, looking up its address the first time; nil when it has no place or
  # the address can't be found
  def self.for(record)
    return unless record.respond_to?(:formatted_address) && record.place.present?

    unless record.latitude && record.longitude
      point = geocode(record.formatted_address.presence || record.place) or return
      record.update_columns(latitude: point[0], longitude: point[1])
    end
    new(record.latitude, record.longitude)
  end

  def initialize(latitude, longitude)
    @latitude = latitude.to_f
    @longitude = longitude.to_f
  end

  def key = Digest::SHA256.hexdigest([VERSION, ZOOM, WIDTH, HEIGHT, latitude.round(5), longitude.round(5)].to_json).first(32)

  def path
    file = DIR.join("#{key}.png")
    return file if file.exist?

    FileUtils.mkdir_p(DIR)
    Dir.mktmpdir("meeting-map") do |dir|
      out = File.join(dir, "map.png")
      run(command(out))
      FileUtils.mv(out, file)
    end
    file
  end

  # [latitude, longitude] for an address, or nil. Remembered either way for a month.
  def self.geocode(address)
    query = address.to_s.squish.first(300)
    return if query.empty?

    Rails.cache.fetch(["geocode", 1, query.downcase], expires_in: 30.days) do
      wait_turn
      uri = URI(geocoder_url)
      uri.query = URI.encode_www_form(q: query, format: "jsonv2", limit: 1)
      hit = JSON.parse(get(uri.to_s)).first
      hit ? [hit["lat"].to_f.round(6), hit["lon"].to_f.round(6)] : false
    end || nil
  rescue StandardError => e
    Rails.logger.warn("[map] geocoding failed: #{e.message}")
    nil
  end

  @lookup = Mutex.new
  @last_lookup = Time.at(0)

  def self.wait_turn
    @lookup.synchronize do
      gap = 1.1 - (Time.current - @last_lookup)
      sleep(gap) if gap.positive?
      @last_lookup = Time.current
    end
  end

  def self.get(url)
    uri = URI(url)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 10) do |http|
      http.request(Net::HTTP::Get.new(uri, "User-Agent" => USER_AGENT, "Referer" => "https://recoverybot.hmblbot.com/"))
    end
    raise Failed, "#{uri.host} answered #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    response.body
  end

  private

  # The point in world pixels at ZOOM (Web Mercator, as the tiles are drawn)
  def world_pixel
    scale = TILE * (2**ZOOM)
    lat = latitude.clamp(-85.0511, 85.0511) * Math::PI / 180
    x = (longitude + 180) / 360 * scale
    y = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math::PI) / 2 * scale
    [x, y]
  end

  def command(out)
    cx, cy = world_pixel
    left = (cx - WIDTH / 2.0).floor
    top = (cy - HEIGHT / 2.0).floor
    tiles = (2**ZOOM)
    args = ["-size", "#{WIDTH}x#{HEIGHT}", "xc:#f2efe9"]
    ((left / TILE)..((left + WIDTH - 1) / TILE)).each do |tx|
      ((top / TILE)..((top + HEIGHT - 1) / TILE)).each do |ty|
        next unless ty.between?(0, tiles - 1)

        file = tile(tx % tiles, ty)
        args += [file, "-geometry", format("%+d%+d", tx * TILE - left, ty * TILE - top), "-composite"]
      end
    end
    px = (cx - left).round
    py = (cy - top).round
    args + pin(px, py) + attribution + [out]
  end

  # A teardrop pin with its point on the spot
  def pin(x, y)
    head = y - 30
    ["-stroke", "#ffffff", "-strokewidth", "3", "-fill", "#2f6fd6",
     "-draw", "path 'M #{x},#{y} L #{x - 11},#{head + 6} A 13,13 0 1,1 #{x + 11},#{head + 6} Z'",
     "-stroke", "none", "-fill", "#ffffff", "-draw", "circle #{x},#{head} #{x + 5},#{head}"]
  end

  def attribution
    ["-gravity", "SouthEast", "-fill", "#ffffffcc", "-draw", "rectangle #{WIDTH - 160},#{HEIGHT - 18} #{WIDTH},#{HEIGHT}",
     "-fill", "#333333", "-font", ShareCard::FONTS[:regular], "-pointsize", "11", "-annotate", "+5+3", ATTRIBUTION]
  end

  # A tile's file, fetched when it's missing or old
  def tile(x, y)
    file = TILE_DIR.join(ZOOM.to_s, x.to_s, "#{y}.png")
    return file.to_s if file.exist? && file.mtime > TILE_DAYS.days.ago

    body = self.class.get(format(self.class.tile_url, z: ZOOM, x: x, y: y))
    FileUtils.mkdir_p(file.dirname)
    File.binwrite(file, body)
    file.to_s
  rescue StandardError => e
    raise Failed, "Couldn't get a map tile: #{e.message}" unless file.exist?

    file.to_s
  end

  def run(args)
    _out, err, status = Open3.capture3(*ShareCard.magick, *args)
    raise Failed, err.to_s.first(500) unless status.success?
  end
end
