require "test_helper"

class ReadingTest < ActiveSupport::TestCase
  test "the share card's excerpt is the start of the reading as plain text, cut on a whole word" do
    short = Reading.new(content: "<div><strong>Just</strong> for&nbsp;today.</div><p>Be kind.</p>")
    assert_equal "Just for today. Be kind.", short.share_excerpt

    long = Reading.new(content: "<p>#{"honesty " * 80}</p>")
    excerpt = long.share_excerpt(100)
    assert excerpt.end_with?("honesty…")
    assert_operator excerpt.size, :<=, 101

    tiptap = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] },
                                      { type: "paragraph", content: [{ type: "text", text: "second" }] }] }.to_json
    assert_equal "First second", Reading.new(richer_content: tiptap).share_excerpt

    assert_equal "", Reading.new.share_excerpt
  end
end
