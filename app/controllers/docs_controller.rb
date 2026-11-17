# The Docs (/docs, /docs/:section, /docs/:section/:page, .../edit) and the About and History
# pages (/about, /history): one React app (entrypoints/docs.jsx) that routes on the client and
# reads /api/docs. Public; a page's audience decides who can read it (DocPage.readable_by).
class DocsController < ApplicationController
  layout "reader"

  def app
    page = find_page
    # The Docs home and pages anyone may read can be found on Google; members' and admins' pages can't
    list_in_search_engines if (params[:path].blank? && params[:alias].blank?) || (page&.audience == "everyone" && page.published?)
    @page_title = page ? "#{page.title} | RecoveryBot Docs" : "Docs | RecoveryBot"
    @page_title = "#{page.title} | RecoveryBot" if page&.path_alias
    @share = ShareMeta.safely do
      if page&.audience == "everyone" && page.published?
        ShareMeta.site(title: page.title, description: page.summary.presence || page.plain_text, path: page.path)
      else
        ShareMeta.site(title: "RecoveryBot Docs", description: "How to use every RecoveryBot tool, step by step.", path: "/docs")
      end
    end
  end

  private

  def find_page
    if params[:alias]
      DocPage.readable_by(current_user).find_by(path_alias: params[:alias])
    else
      section_slug, page_slug = params[:path].to_s.split("/")
      return unless page_slug

      DocPage.readable_by(current_user).joins(:section).find_by(slug: page_slug, doc_sections: { slug: section_slug })
    end
  end
end
