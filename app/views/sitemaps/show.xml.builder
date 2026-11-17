xml.instruct! :xml, version: "1.0", encoding: "UTF-8"
xml.urlset xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" do
  SitemapsController::STATIC_PATHS.each { |path| xml.url { xml.loc @base + path } }
  @docs.each do |page|
    xml.url do
      xml.loc @base + page.path
      xml.lastmod page.updated_at.to_date.iso8601
    end
  end
  @groups.each do |group|
    xml.url do
      xml.loc "#{@base}/groups/#{group.slug}"
      xml.lastmod group.updated_at.to_date.iso8601
    end
    group.meetings.each { |meeting| xml.url { xml.loc "#{@base}/groups/#{group.slug}/meetings/#{meeting.id}" } }
  end
end
