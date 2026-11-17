require "test_helper"

class EventBlocksTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  test "a page keeps only the first of each one-per-page block" do
    raw = [
      { "id" => "t1", "type" => "timeline" }, { "id" => "n1", "type" => "notes" },
      { "id" => "t2", "type" => "timeline" }, { "id" => "n2", "type" => "notes" },
    ]
    assert_equal %w[t1 n1 n2], EventBlocks.normalize(raw, types: EventBlocks::GROUP_TYPES).map { |b| b["id"] }

    feeds = [{ "id" => "f1", "type" => "feed" }, { "id" => "f2", "type" => "feed", "region" => "side" }, { "id" => "a", "type" => "about" }]
    assert_equal %w[f1 a], EventBlocks.normalize(feeds, types: EventBlocks::PROFILE_TYPES).map { |b| b["id"] }
  end

  test "other blocks can repeat" do
    raw = [{ "type" => "notes" }, { "type" => "notes" }, { "type" => "gallery" }, { "type" => "gallery" }]
    assert_equal 4, EventBlocks.normalize(raw).size
  end
end
