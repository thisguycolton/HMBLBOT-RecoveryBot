require "test_helper"

# Sharing a fun day-count fact: its page (/facts/:days), its picture (FactCard) and its link preview
class FactSharesTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  setup { Rails.application.reload_routes_unless_loaded }

  def meta(property) = css_select("meta[property='#{property}'], meta[name='#{property}']").first&.[]("content")

  test "a fact's page shows the fact with a clean preview and names nobody" do
    fact = DayFacts.all.first
    get "/facts/#{fact.days}"
    assert_response :success
    assert_equal fact.share_title, meta("og:title")
    assert_equal fact.detail, meta("og:description")
    assert_match %r{/share_cards/fact/#{fact.days}\.png}, meta("og:image")
    assert_equal "summary_large_image", meta("twitter:card")
    assert_select "h1", fact.headline
    assert_select "img[src*='/facts/#{fact.days}/card']"
  end

  test "a title that is just the count leads with the detail instead of saying it twice" do
    fact = DayFacts.all.find(&:plain?)
    get "/facts/#{fact.days}"
    assert_equal fact.days_label, meta("og:title")
    assert_select "h1", fact.detail
    assert_select "p.detail", false
  end

  test "a look carries into the preview picture" do
    fact = DayFacts.all.last
    get "/facts/#{fact.days}?look=night"
    assert_match "look=night", meta("og:image")
    assert_match "look=night", meta("og:url").to_s
  end

  test "a day with no fact is not found" do
    missing = (1..100_000).find { |d| DayFacts.find(d).nil? }
    get "/facts/#{missing}"
    assert_response :not_found
    get "/facts/#{missing}/card"
    assert_response :not_found
  end

  test "the picture is a PNG, and a download comes as a file" do
    fact = DayFacts.find(2000) || DayFacts.all.first
    get "/facts/#{fact.days}/card?look=paper&size=story"
    assert_response :success
    assert_equal "image/png", response.media_type
    assert response.body.start_with?("\x89PNG".b)
    get "/facts/#{fact.days}/card?download=1"
    assert_match "attachment", response.headers["Content-Disposition"]
  end

  test "each look and size draws its own picture" do
    fact = DayFacts.all.first
    keys = FactCard::LOOKS.product(FactCard::SIZES.keys).map { |look, size| FactCard.new(fact, look:, size:).key }
    assert_equal keys.size, keys.uniq.size
    assert_equal FactCard.new(fact).key, FactCard.new(fact, look: "bogus", size: "huge").key
  end
end
