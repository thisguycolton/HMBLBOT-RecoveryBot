# Hidden from search engines unless a page says otherwise. Every response carries
# `X-Robots-Tag: noindex, nofollow`, so a new page can never end up on Google by accident.
# The few pages that say nothing about any person opt in:
#
#   allow_search_engines only: :home               # always listed
#   def show; list_in_search_engines if public?; end # listed when this record is public
#
# A controller's own stronger tag (KeepsRobotsOut on the library) always wins. Never use
# `keep_robots_out` on a listed page: it turns Googlebot away with a 403.
# See /mnt/project-files/seo/plan.md (the plan), public/robots.txt and SitemapsController.
module SearchEngines
  extend ActiveSupport::Concern

  HIDDEN = "noindex, nofollow"

  included do
    # First thing, so even a sign-in redirect or a halted request carries it
    prepend_before_action :hide_from_search_engines
    helper_method :search_listed?
  end

  class_methods do
    def allow_search_engines(**options)
      before_action :list_in_search_engines, **options
    end
  end

  def search_listed? = !!@search_listed

  private

  def list_in_search_engines
    @search_listed = true
    response.headers.delete("X-Robots-Tag") if response.headers["X-Robots-Tag"] == HIDDEN
  end

  def hide_from_search_engines
    response.headers["X-Robots-Tag"] = HIDDEN
  end
end
