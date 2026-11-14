require "test_helper"

# Notification.plain: what the bell and push notifications show of markdown (note excerpts)
class NotificationPlainTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  test "markdown reads as plain words" do
    {
      "# iOS Users!!  Test the real app on your iPhone!" => "iOS Users!! Test the real app on your iPhone!",
      "### **Android Users!!**\nClosed Testing is LIVE!" => "Android Users!! Closed Testing is LIVE!",
      "Sign up at [the form](https://hmblbot.com/testflight) or https://hmblbot.com" => "Sign up at the form or https://hmblbot.com",
      "- one\n- two\n1. three\n> quoted" => "one two three quoted",
      "_so_ *very* ~~not~~ `code` ***wow***" => "so very not code wow",
      "a snake_case_name and 2 * 3 * 4" => "a snake_case_name and 2 * 3 * 4",
      "![pic](https://x.test/a.png) caption" => "caption",
      "before\n```\nputs 1\n```\nafter" => "before after",
      "#1 fan, <b>bold</b> and \\*stars\\*" => "#1 fan, bold and *stars*",
    }.each { |md, plain| assert_equal plain, Notification.plain(md), md }
    assert_nil Notification.plain(nil)
  end
end
