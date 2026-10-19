require "test_helper"

class DocumentHtmlTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  test "text and highlight colors stay; anything else in a style or an event handler goes" do
    html = DocumentHtml.sanitize(%(<p><span style="color: #dc2626; position: fixed" onclick="x()">Red</span> <mark data-color="#fef08a" style="background-color: #fef08a">marked</mark></p>))
    assert_includes html, %(<span style="color:#dc2626;">Red</span>)
    assert_includes html, %(<mark data-color="#fef08a" style="background-color:#fef08a;">marked</mark>)
    assert_no_match(/position|onclick/, html)
  end
end
