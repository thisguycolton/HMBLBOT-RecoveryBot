require "test_helper"

# app/javascript/lib/dayFacts.json: the fun day-count facts the Today panel, the day count
# modal and the phone widgets show. Each day count gets exactly one fact, so nobody sees two
# at once, and the list stays in day order because dayFacts.js and the widgets read it that way.
class DayFactsTest < ActiveSupport::TestCase
  FACTS = JSON.parse(File.read(Rails.root.join("app/javascript/lib/dayFacts.json")))
  TOPICS = %w[space nature history numbers body].freeze

  test "one fact per day count, in day order" do
    days = FACTS.map { |f| f["days"] }
    dupes = days.tally.select { |_, n| n > 1 }.keys
    assert_empty dupes, "more than one fact on day #{dupes.join(', ')}"
    assert_equal days.sort, days
  end

  test "every fact is complete and says something new" do
    FACTS.each do |f|
      assert f["days"].is_a?(Integer) && f["days"].positive?, f.inspect
      assert_includes TOPICS, f["topic"], f.inspect
      assert f["title"].present? && f["detail"].present?, f.inspect
    end
    details = FACTS.map { |f| f["detail"] }
    assert_empty details.tally.select { |_, n| n > 1 }.keys, "the same detail is used twice"
  end
end
