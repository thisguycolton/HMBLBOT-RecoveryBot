# GET /sitemap.xml: the pages search engines may list (SearchEngines) and nothing else. The
# site's own pages, Docs pages anyone may read, and approved groups that are listed in search
# (groups.search_listed) with their meetings. robots.txt points crawlers here.
class SitemapsController < ApplicationController
  skip_after_action :track_action
  allow_search_engines

  STATIC_PATHS = %w[/ /about /history /docs /groups/meetings /topicificator /install /privacy /terms /contact].freeze

  def show
    @base = Rails.env.production? ? "https://#{request.host}" : request.base_url
    @docs = DocPage.published.where(audience: "everyone").includes(:section).ordered.reject { |page| STATIC_PATHS.include?(page.path) }
    @groups = Group.listed_in_search.includes(:meetings).order(:title)
    expires_in 1.hour, public: true
    render formats: :xml
  end
end
