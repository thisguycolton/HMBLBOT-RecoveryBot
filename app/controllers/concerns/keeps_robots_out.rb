# Readings and the library's books are for people, not crawlers or AI scrapers. Controllers
# that serve their text call `keep_robots_out` (optionally with only:/except:), which:
# - answers known bots, crawlers and scripted clients with 403 before any text is loaded
# - marks every response noindex/noarchive so a search engine that gets through keeps nothing
# public/robots.txt asks the polite ones to stay away from the same paths.
module KeepsRobotsOut
  extend ActiveSupport::Concern

  # Search and AI crawlers, link-preview fetchers, SEO tools and command-line/scripted clients.
  # Browsers never send these words in their user agent.
  ROBOT_AGENT = /
    bot\b|bot\/|crawl|spider|slurp|scrap|archiv|index|fetch|preview|
    gpt|claude|anthropic|openai|perplexity|cohere|ccbot|bytespider|amazonbot|applebot|
    diffbot|omgili|facebookexternalhit|meta-external|semrush|ahrefs|mj12|dataforseo|
    headless|phantom|puppeteer|playwright|selenium|
    curl|wget|python|httpx|aiohttp|go-http|java\/|okhttp|axios|node-fetch|undici|ruby|libwww|httpclient|scrapy
  /xi

  ROBOTS_TAG = "noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai"

  class_methods do
    def keep_robots_out(**options)
      before_action :turn_robots_away, **options
      after_action :tag_noindex, **options
    end
  end

  def robot_request?
    request.user_agent.to_s.match?(ROBOT_AGENT)
  end

  private

  def turn_robots_away
    return unless robot_request?
    response.headers["X-Robots-Tag"] = ROBOTS_TAG
    head :forbidden
  end

  def tag_noindex
    response.headers["X-Robots-Tag"] = ROBOTS_TAG
  end
end
