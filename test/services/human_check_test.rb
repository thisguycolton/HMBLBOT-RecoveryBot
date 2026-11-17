require "test_helper"

class HumanCheckTest < ActiveSupport::TestCase
  def payload(challenge, number, **changes)
    Base64.strict_encode64(challenge.slice(:algorithm, :challenge, :salt, :signature).merge(number: number, took: 900).merge(changes).to_json)
  end

  test "a solved ALTCHA puzzle passes, and only once" do
    challenge = HumanCheck.altcha_challenge(number: 42)
    with_cache do
      assert HumanCheck.altcha_passed?(payload(challenge, 42))
      assert_not HumanCheck.altcha_passed?(payload(challenge, 42)), "the same solution can't be posted twice"
    end
  end

  test "wrong answers, made-up puzzles and old ones fail" do
    challenge = HumanCheck.altcha_challenge(number: 42)
    assert_not HumanCheck.altcha_passed?(payload(challenge, 41))

    salt = "made-up?expires=#{1.hour.from_now.to_i}"
    easy = Digest::SHA256.hexdigest("#{salt}1")
    assert_not HumanCheck.altcha_passed?(payload(challenge, 1, salt: salt, challenge: easy)), "the signature must match"

    old = HumanCheck.altcha_challenge(number: 42, expires_at: 1.minute.ago)
    assert_not HumanCheck.altcha_passed?(payload(old, 42))

    assert_not HumanCheck.altcha_passed?(nil)
    assert_not HumanCheck.altcha_passed?("not base64!")
    assert_not HumanCheck.altcha_passed?(Base64.strict_encode64("[1]"))
  end

  test "forms get a puzzle unless Turnstile is set up" do
    assert_equal "SHA-256", HumanCheck.fields[:altcha][:algorithm]

    ENV["TURNSTILE_SITE_KEY"], ENV["TURNSTILE_SECRET_KEY"] = "site", "secret"
    assert_nil HumanCheck.fields[:altcha]
  ensure
    ENV.delete("TURNSTILE_SITE_KEY")
    ENV.delete("TURNSTILE_SECRET_KEY")
  end

  private

  def with_cache
    original = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
    yield
  ensure
    Rails.cache = original
  end
end
