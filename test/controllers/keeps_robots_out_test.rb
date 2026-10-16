require "test_helper"

class KeepsRobotsOutTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    book = Book.create!(title: "Daily Reflections", slug: "daily-reflections", work_key: "dr", edition: "1e", language: "en")
    book.chapters.create!(title: "January 10", slug: "january-10", index: 0, content: "<p>Secret text</p>",
                          tiptap_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Secret text" }] }] })
  end

  BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"

  test "crawlers, AI scrapers and scripts get 403 on books and readings" do
    [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "CCBot/2.0 (https://commoncrawl.org/faq/)",
      "python-requests/2.32.3",
      "curl/8.7.1",
    ].each do |agent|
      %w[/api/books/daily-reflections/chapters/january-10 /api/books /readings /service_readings /library].each do |path|
        get path, headers: { "User-Agent" => agent, "Accept" => "application/json" }
        assert_response :forbidden, "#{agent} on #{path}"
        assert_match "noindex", response.headers["X-Robots-Tag"]
        assert_no_match "Secret text", response.body
      end
    end
  end

  test "people get the text, marked noindex" do
    get "/api/books/daily-reflections/chapters/january-10", headers: { "User-Agent" => BROWSER }, as: :json
    assert_response :success
    assert_match "Secret text", response.body
    assert_match "noarchive", response.headers["X-Robots-Tag"]
  end

  test "the home page stays open to search engines" do
    get "/", headers: { "User-Agent" => "Mozilla/5.0 (compatible; Googlebot/2.1)" }
    assert_response :success
    assert_nil response.headers["X-Robots-Tag"]
  end

  test "robots.txt keeps crawlers off the texts" do
    robots = Rails.root.join("public/robots.txt").read
    %w[/library /books /readings /service_readings /api/].each { |path| assert_includes robots, "Disallow: #{path}" }
    assert_includes robots, "User-agent: GPTBot"
  end
end
