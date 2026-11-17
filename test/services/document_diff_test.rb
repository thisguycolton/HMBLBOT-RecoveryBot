require "test_helper"

class DocumentDiffTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  test "counts words added and removed, and the sections they were in" do
    old = "<h2>Opening</h2><p>The chair opens at 7:00 sharp.</p><h2>Seventh Tradition</h2><p>Venmo only.</p><h2>Closing</h2><p>Keep coming back.</p>"
    new = "<h2>Opening</h2><p>The chair opens at the top of the hour.</p><h2>Seventh Tradition</h2><p>Venmo only.</p><h2>Closing</h2><p>Keep coming back.</p><p>Thanks.</p>"
    assert_equal({ words_added: 6, words_removed: 2, sections: %w[Opening Closing] }, DocumentDiff.stats(old, new))
  end

  test "the same text is no change, whatever its formatting" do
    assert_equal({ words_added: 0, words_removed: 0, sections: [] }, DocumentDiff.stats("<p>Be <b>kind</b></p>", "<p>Be <em>kind</em></p>"))
  end

  test "reads list items, table rows, line breaks, Markdown and loose text as blocks" do
    blocks = DocumentDiff.blocks("<ul><li><p>One<br>two</p></li></ul><table><tr><td><p>a</p></td><td>b</td></tr></table>")
    assert_equal [%w[li One\ two], ["tr", "a | b"]], blocks.map { |b| [b[:tag], b[:text]] }
    assert_equal ["Hi", "Text"], DocumentDiff.blocks("# Hi\n\nText", "markdown").map { |b| b[:text] }
    assert_equal ["Just words"], DocumentDiff.blocks("Just words").map { |b| b[:text] }
    assert_equal({ words_added: 1, words_removed: 0, sections: ["Hi"] }, DocumentDiff.stats("# Hi\n\nText", "<h2>Hi</h2><p>Text more</p>", "markdown", "html"))
  end
end
