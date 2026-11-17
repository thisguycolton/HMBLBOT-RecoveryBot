require "test_helper"

# How far along a share video is, for the page's progress ring
class CardProgressTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup { CardProgress.clear! }

  test "notes stage and percent, never going backwards within a stage" do
    note = CardProgress.for("abcdefghijkl", 7)
    note.update(:drawing, 0.2)
    note.update(:drawing, 0.1)
    assert_equal({ stage: "drawing", percent: 20 }, CardProgress.read("abcdefghijkl", 7))
    note.update(:encoding, 0.5)
    assert_equal({ stage: "encoding", percent: 50 }, CardProgress.read("abcdefghijkl", 7))
    assert_nil CardProgress.read("abcdefghijkl", 8), "another person's"
  end

  test "ignores tokens that don't look like one" do
    assert_nil CardProgress.for("short", 1)
    assert_nil CardProgress.for("../../etc/passwd!!", 1)
    assert_nil CardProgress.read(nil, 1)
  end

  test "a video notes its drawing, then ffmpeg's progress, then done" do
    skip "no ffmpeg" unless system("ffmpeg", "-version", out: File::NULL, err: File::NULL)
    seen = []
    card = QuoteCard.new(quote: "We came to see that the old ideas would not do. " * 4, kind: :reading, look: "night", size: "wide", video: true, turn: "fast")
    card.progress = Struct.new(:seen) { def update(stage, fraction = 0) = seen << [stage.to_s, fraction] }.new(seen)
    assert card.path.exist?
    stages = seen.map(&:first).chunk_while { |a, b| a == b }.map(&:first)
    assert_equal %w[drawing encoding done], stages
    assert seen.each_cons(2).all? { |(_, a), (_, b)| b >= a }, "only ever goes up"
  end
end
