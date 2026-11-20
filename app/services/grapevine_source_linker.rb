require "net/http"
require "csv"

# Fills in source_url for readings taken from AA Grapevine (`bin/rails grapevine:link_sources`).
#
# It only reads Grapevine's public search page (https://www.aagrapevine.org/site-search?keys=…),
# the same page anyone sees without signing in, and keeps to its robots.txt crawl delay. It never
# signs in, sends no cookie and doesn't open the stories themselves. For each reading it searches
# its title and keeps the article whose title matches exactly; when several match, the month and
# year in the reading's source line ("Grapevine, May 1990") pick between them. A reading with no
# single match gets a link to the Grapevine search for its title instead, and is listed as unmatched.
class GrapevineSourceLinker
  SEARCH_URL = Reading::GRAPEVINE_SEARCH_URL
  USER_AGENT = "RecoveryBot source linker (+https://recoverybot.hmblbot.com)"
  # Grapevine's robots.txt asks for 5 seconds between requests
  DELAY = 5
  MONTHS = Date::MONTHNAMES.compact.map(&:downcase)

  Result = Struct.new(:reading, :status, :url, :note, keyword_init: true)

  # Readings taken from Grapevine that have no link yet (or, with redo, only a search link)
  def self.scope(redo_search_links: false, all: false, ids: [])
    return Reading.where(id: ids) if ids.any?

    readings = Reading.where("readings.source ILIKE ? OR readings.source ILIKE ? OR readings.source_url ILIKE ?", "%grapevine%", "%grape vine%", "%aagrapevine.org%")
    return readings if all

    missing = readings.where(source_url: [nil, ""])
    redo_search_links ? missing.or(readings.where("readings.source_url ILIKE ?", "%/site-search%")) : missing
  end

  def initialize(dry_run: false, delay: DELAY, out: $stdout, fetcher: nil)
    @dry_run = dry_run
    @delay = delay
    @out = out
    @fetcher = fetcher || method(:fetch)
    @cache = {}
  end

  def run(readings)
    readings.order(:id).map do |reading|
      result = link(reading)
      @out.puts "#{result.status.to_s.ljust(9)} ##{reading.id} #{reading.title} -> #{result.url}#{" (#{result.note})" if result.note}"
      result
    end
  end

  def link(reading)
    title = reading.title.to_s.squish
    return Result.new(reading: reading, status: :skipped, note: "no title") if title.blank?

    # The story's own link pasted into the Source line: use it as it is
    pasted = reading.source.to_s[%r{https?://(?:www\.)?aagrapevine\.org/magazine/\d{4}/[a-z]{3}/[^\s/?#]+}]
    if pasted
      save(reading, pasted)
      return Result.new(reading: reading, status: :matched, url: pasted, note: "link from the Source line")
    end

    articles = search(title)
    matches = articles.select { |a| self.class.normalize(a[:title]) == self.class.normalize(title) }
    matches = pick_by_author(matches, reading.source) if matches.size > 1
    matches = pick_by_date(matches, reading.source) if matches.size > 1

    if matches.size == 1
      save(reading, matches.first[:url])
      Result.new(reading: reading, status: :matched, url: matches.first[:url])
    else
      url = Reading.grapevine_search_url(title)
      save(reading, url)
      note = matches.empty? ? "no article with this title" : "#{matches.size} articles with this title"
      Result.new(reading: reading, status: :unmatched, url: url, note: note)
    end
  rescue StandardError => e
    Result.new(reading: reading, status: :error, note: "#{e.class}: #{e.message}".first(200))
  end

  # The articles on the search page for this title: { title:, url:, date: "April 2021" }
  def search(title)
    key = self.class.normalize(title)
    return @cache[key] if @cache.key?(key)

    sleep(@delay) if @fetched && @delay.positive?
    @fetched = true
    @cache[key] = self.class.parse(@fetcher.call(SEARCH_URL + ERB::Util.url_encode(title)))
  end

  def self.parse(html)
    doc = Nokogiri::HTML(html.to_s)
    doc.css(".views-row").filter_map do |row|
      link = row.at_css("h3 a.article-node") || row.at_css("h3 a")
      next unless link

      url = link["href"].to_s
      url = "https://www.aagrapevine.org#{url}" if url.start_with?("/")
      # Stories only: not their audio versions or other kinds of page
      next unless url.match?(%r{\Ahttps://(www\.)?aagrapevine\.org/magazine/\d{4}/[a-z]{3}/(?!audio/)[^/?#]+\z})

      { title: link.text.squish, url: url, date: row.at_css(".article-publication-date")&.text.to_s.split("|").first.to_s.squish,
        author: row.at_css(".article-author")&.text.to_s.sub(/\A\s*By:\s*/i, "").squish }
    end.uniq { |a| a[:url] }
  end

  # Titles compared without case, punctuation, curly quotes or a leading "A"/"An"/"The"
  def self.normalize(title)
    title.to_s.unicode_normalize(:nfkd).downcase.tr("‘’“”", "''\"\"").gsub(/[^a-z0-9 ]/, " ").squish.sub(/\A(the|a|an) /, "")
  end

  private

  # Several articles share the title: the one whose byline the source line names
  # ("AA Grapevine | CHRIS C. | OREGON, OHIO" against "By: Chris C. | Oregon, Ohio")
  def pick_by_author(matches, source)
    parts = source.to_s.split(/\s*[|\-–]\s*/).map { |p| self.class.normalize(p.sub(/\ABy:\s*/i, "")) }.reject { |p| p.blank? || p.include?("grapevine") }
    return matches if parts.empty?

    by_author = matches.select do |a|
      byline = a[:author].to_s.split("|").map { |p| self.class.normalize(p) }
      byline.first.present? && parts.include?(byline.first)
    end
    by_author.any? ? by_author : matches
  end

  # Several articles share the title: the one from the month and year (or year) the source names
  def pick_by_date(matches, source)
    text = source.to_s.downcase
    year = text[/\b(19|20)\d{2}\b/]
    return matches unless year

    month = MONTHS.find { |m| text.match?(/\b#{m}\b/) } || MONTHS.find { |m| text.match?(/\b#{m.first(3)}\b/) }
    by_year = matches.select { |a| a[:url].include?("/magazine/#{year}/") }
    return by_year unless month && by_year.size > 1

    by_year.select { |a| a[:url].include?("/magazine/#{year}/#{month.first(3)}/") }
  end

  def save(reading, url)
    reading.update_column(:source_url, url) unless @dry_run
  end

  def fetch(url)
    uri = URI(url)
    Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 20) do |http|
      response = http.get(uri.request_uri, "User-Agent" => USER_AGENT, "Accept" => "text/html")
      raise "Grapevine answered #{response.code}" unless response.is_a?(Net::HTTPSuccess)

      response.body
    end
  end
end
