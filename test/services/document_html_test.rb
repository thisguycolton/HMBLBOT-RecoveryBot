require "test_helper"

class DocumentHtmlTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  test "text and highlight colors stay; anything else in a style or an event handler goes" do
    html = DocumentHtml.sanitize(%(<p><span style="color: #dc2626; position: fixed" onclick="x()">Red</span> <mark data-color="#fef08a" style="background-color: #fef08a">marked</mark></p>))
    assert_includes html, %(<span style="color:#dc2626;">Red</span>)
    assert_includes html, %(<mark data-color="#fef08a" style="background-color:#fef08a;">marked</mark>)
    assert_no_match(/position|onclick/, html)
  end

  test "the Command Center's section marks and milestone forms stay" do
    html = DocumentHtml.sanitize(%(<div data-hc-section="" data-title="Newcomers"></div><p>Anyone celebrating?</p><div data-hc-form="milestones" onclick="x()"></div>))
    assert_includes html, %(data-title="Newcomers")
    assert_includes html, %(<div data-hc-form="milestones"></div>)
    assert_no_match(/onclick/, html)
  end

  test "collapsible text stays, and its line counts as words" do
    html = DocumentHtml.sanitize(%(<details open onclick="x()"><summary>The Twelve Traditions</summary><p>One: our common welfare</p></details>))
    assert_includes html, %(<details><summary>The Twelve Traditions</summary><p>One: our common welfare</p></details>)
    assert_equal "The Twelve Traditions One: our common welfare", DocumentHtml.text(html)
  end
end
