require "test_helper"

class GrapevineSourceLinkerTest < ActiveSupport::TestCase
  def row(title, url, date, author = "Anonymous | Somewhere")
    <<~HTML
      <div class="views-row"><div class="layout--article"><div class="main-region">
        <h3 class="audible"><a class="article-node" href="#{url}">#{title}</a></h3>
        <div class="article-publication-date">#{date} | Something</div>
        <div class="article-author">By: #{author}</div>
      </div></div></div>
    HTML
  end

  def page(*rows) = "<html><body>#{rows.join}</body></html>"

  setup do
    @user = User.create!(email: "linker@example.com", name: "L", password: "password123", confirmed: true)
  end

  test "matches the story with the same title, skipping audio and other titles" do
    html = page(row("Lifeline in Cameroon", "https://www.aagrapevine.org/magazine/2026/dec/audio/lifeline-cameroon", "December 2026"),
                row("Lifeline", "https://www.aagrapevine.org/magazine/2021/apr/lifeline", "April 2021"),
                row("Lifeline in Cameroon", "https://www.aagrapevine.org/magazine/2026/dec/lifeline-cameroon", "December 2026"))
    reading = Reading.create!(title: "Lifeline in Cameroon", source: "Grapevine", content: "x", user: @user)

    GrapevineSourceLinker.new(delay: 0, out: StringIO.new, fetcher: ->(_url) { html }).run(Reading.where(id: reading.id))
    assert_equal "https://www.aagrapevine.org/magazine/2026/dec/lifeline-cameroon", reading.reload.source_url
  end

  test "the source's month and year pick between stories with the same title, else a search link" do
    html = page(row("Gratitude", "https://www.aagrapevine.org/magazine/1990/may/gratitude", "May 1990"),
                row("Gratitude", "https://www.aagrapevine.org/magazine/2004/nov/gratitude", "November 2004"))
    dated = Reading.create!(title: "Gratitude", source: "AA Grapevine, November 2004", content: "x", user: @user)
    undated = Reading.create!(title: "Gratitude", source: "AA Grapevine", content: "x", user: @user)
    missing = Reading.create!(title: "No Such Story", source: "Grapevine", content: "x", user: @user)

    results = GrapevineSourceLinker.new(delay: 0, out: StringIO.new, fetcher: ->(url) { url.include?("No%20Such") ? page : html })
                                   .run(Reading.where(id: [dated.id, undated.id, missing.id]))
    assert_equal "https://www.aagrapevine.org/magazine/2004/nov/gratitude", dated.reload.source_url
    assert_equal Reading.grapevine_search_url("Gratitude"), undated.reload.source_url
    assert_equal Reading.grapevine_search_url("No Such Story"), missing.reload.source_url
    assert_equal %i[matched unmatched unmatched], results.map(&:status)
  end

  test "a dry run saves nothing, and only Grapevine readings without a link are picked" do
    linked = Reading.create!(title: "Done", source: "Grapevine", source_url: "https://www.aagrapevine.org/magazine/2001/jan/done", content: "x", user: @user)
    other = Reading.create!(title: "Other", source: "Daily Reflections", content: "x", user: @user)
    todo = Reading.create!(title: "Todo", source: "AA Grapevine", content: "x", user: @user)
    scope = GrapevineSourceLinker.scope
    assert_includes scope, todo
    refute_includes scope, linked
    refute_includes scope, other

    GrapevineSourceLinker.new(dry_run: true, delay: 0, out: StringIO.new, fetcher: ->(_) { page }).run(Reading.where(id: todo.id))
    assert_nil todo.reload.source_url
  end

  test "the byline in the source picks between stories with the same title, and a pasted story link is used as is" do
    html = page(row("Love", "https://www.aagrapevine.org/magazine/1980/jan/love", "January 1980", "J. D. | Ohio"),
                row("Love", "https://www.aagrapevine.org/magazine/2019/feb/love", "February 2019", "C.C. | North Hollywood, California"))
    by_line = Reading.create!(title: "Love", source: "AA Grapevine| C.C. | NORTH HOLLYWOOD, CALIFORNIA", content: "x", user: @user)
    pasted = Reading.create!(title: "Bullets", source: "https://www.aagrapevine.org/magazine/2024/oct/bullets-bottles", content: "x", user: @user)

    GrapevineSourceLinker.new(delay: 0, out: StringIO.new, fetcher: ->(_) { html }).run(Reading.where(id: [by_line.id, pasted.id]))
    assert_equal "https://www.aagrapevine.org/magazine/2019/feb/love", by_line.reload.source_url
    assert_equal "https://www.aagrapevine.org/magazine/2024/oct/bullets-bottles", pasted.reload.source_url
  end
end
