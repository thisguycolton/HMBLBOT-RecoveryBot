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

  test "blocks that show the same thing anywhere appear once" do
    profile = %w[about groups chips about groups chips people people].map { |t| { "type" => t } }
    assert_equal %w[about groups chips people people], EventBlocks.normalize(profile, types: EventBlocks::PROFILE_TYPES).map { |b| b["type"] }

    group = %w[meetings events join members literature readings business_meeting guidelines documents decisions]
    kept = EventBlocks.normalize((group * 2).map { |t| { "type" => t } }, types: EventBlocks::GROUP_TYPES).map { |b| b["type"] }
    assert_equal group + %w[documents decisions], kept

    event = %w[guidelines conscience_agenda agenda poll guidelines conscience_agenda agenda poll].map { |t| { "type" => t } }
    assert_equal %w[guidelines conscience_agenda agenda poll agenda poll], EventBlocks.normalize(event).map { |b| b["type"] }
  end

  test "text, photos, people, documents, decisions, agendas and polls can repeat" do
    raw = [{ "type" => "notes" }, { "type" => "notes" }, { "type" => "gallery" }, { "type" => "gallery" }, { "type" => "heading" }, { "type" => "heading" }]
    assert_equal 6, EventBlocks.normalize(raw).size
  end
end
