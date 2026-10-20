require "test_helper"

class LinkPreviewTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  test "only http and https links are looked at" do
    assert_nil LinkPreview.fetch("javascript:alert(1)")
    assert_nil LinkPreview.fetch("file:///etc/passwd")
    assert_nil LinkPreview.fetch("not a link")
  end

  test "addresses inside our own network are never fetched" do
    preview = LinkPreview.new
    %w[127.0.0.1 10.0.0.5 192.168.1.1 169.254.169.254 0.0.0.0 ::1 100.64.0.1].each do |ip|
      assert_raises(LinkPreview::Blocked, ip) { preview.send(:public_address, ip) }
    end
    assert_equal "93.184.215.14", preview.send(:public_address, "93.184.215.14")
    assert_nil LinkPreview.new.fetch("http://127.0.0.1/")
    assert_nil LinkPreview.new.image("http://169.254.169.254/latest/meta-data")
  end
end
