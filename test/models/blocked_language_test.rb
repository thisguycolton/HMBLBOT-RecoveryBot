require "test_helper"

# The test cases necessarily spell out the words being blocked.
class BlockedLanguageTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  BLOCKED = [
    "nigger", "NIGGA", "you niggas", "n1gg3r", "n!gga", "niiiiggggaaa", "n*gger", "sandnigger",
    "n i g g e r", "n.i.g.g.e.r", "n-1-g-g-a", "nig ger",
    "ｎｉｇｇｅｒ", "nіggеr", "n​igger", "níggér", "<p>n<b>i</b>gger</p>", "n&#105;gger",
    "spic", "go home spics", "$pic", "s p i c", "wetback", "ch1nk", "gooks", "k1ke", "kikes",
    "f4ggot", "faggot", "towelhead", "towel head", "coon", "porch-monkey", "redskins",
    "heil hitler", "Sieg Heil!"
  ].freeze

  ALLOWED = [
    "fuck this shit", "you're a bitch", "kiss my ass", "damn it", "what the hell", "bastard", "dick", "crap",
    "classic", "Scunthorpe", "Niger", "Nigeria", "niggle", "niggling", "snigger", "sniggering", "niggardly",
    "spice", "spices", "suspicious", "auspicious", "Japan", "Japanese", "Pakistan", "Pakistani",
    "raccoon", "cocoon", "tycoon", "Maine Coon", "coonhound", "a chink in the armor", "a chink of light",
    "honky-tonk", "spick and span", "woop woop", "Jaap", "it's pic of me", "yield", "bond yld", "Yiddish",
    "squawk", "white power strip", "begin again", "running gag", "Knigge", "<p>coon</p><p>dog</p>",
    "Today I shared about my resentments and my 4th step.", "Bill W. got sober in 1935, Dr. Bob in 1966. a",
    "help them discover a chink in the walls their ego has built"
  ].freeze

  test "racist slurs and hate speech are found, however they're disguised" do
    missed = BLOCKED.reject { |text| BlockedLanguage.found?(text) }
    assert_empty missed
  end

  test "ordinary swearing and innocent words are fine" do
    caught = ALLOWED.select { |text| BlockedLanguage.found?(text) }
    assert_empty caught
  end

  test "match gives what was found; blank is fine" do
    assert_equal "spic", BlockedLanguage.match("you spic")
    assert_nil BlockedLanguage.match(nil)
    assert_nil BlockedLanguage.match("")
  end

  test "strings in JSON are checked, but not links or embedded files" do
    blocks = [{ "type" => "text", "text" => "hello" }, { "type" => "list", "items" => ["ok", "wetback"] }]
    assert BlockedLanguage.found?(*BlockedLanguage.strings_in(blocks))
    refute BlockedLanguage.found?(*BlockedLanguage.strings_in({ "url" => "https://example.com/spic", "img" => "data:image/png;base64,abc" }))
  end

  test "long text is quick" do
    text = "Today I went to a meeting and shared about my resentments. " * 2000
    assert_operator Benchmark.realtime { BlockedLanguage.found?(text) }, :<, 1
  end
end
