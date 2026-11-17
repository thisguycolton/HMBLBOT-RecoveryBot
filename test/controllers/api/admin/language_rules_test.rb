require "test_helper"

# Site Admin > Blocked words: the list (LanguageRule) everything people write is checked against.
class Api::Admin::LanguageRulesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, name: "Admin", admin: true)
    @member = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee")
    LanguageRule.import_starter_list!
  end

  test "only site admins see or change the list" do
    sign_in @member
    get "/api/admin/language_rules", as: :json
    assert_response :forbidden
    post "/api/admin/language_rules", params: { language_rule: { kind: "word", term: "frobnicate" } }, as: :json
    assert_response :forbidden
  end

  test "a word an admin adds is blocked right away, and allowed again once removed" do
    sign_in @admin
    with_admins do
      assert_nil BlockedLanguage.match("you frobnicator")

      post "/api/admin/language_rules", params: { language_rule: { kind: "anywhere", term: "Frobnicat", note: "test" } }, as: :json
      assert_response :created
      rule_id = response.parsed_body["id"]
      assert_equal "frobnicat", response.parsed_body["term"]
      assert BlockedLanguage.found?("you fr0bn1cator")
      refute TimelineNote.new(user: @member, body: "f r o b n i c a t", visibility: "private").valid?

      post "/api/admin/language_rules/check", params: { text: "what a frobnicator" }, as: :json
      assert_equal true, response.parsed_body["blocked"]

      post "/api/admin/language_rules", params: { language_rule: { kind: "anywhere", term: "frobnicat" } }, as: :json
      assert_response :unprocessable_entity
      assert_match(/already/, response.parsed_body["errors"].first)

      delete "/api/admin/language_rules/#{rule_id}", as: :json
      assert_response :no_content
      refute BlockedLanguage.found?("you frobnicator")
    end
  end

  test "an allowed phrase lets an innocent use through" do
    sign_in @admin
    with_admins do
      assert BlockedLanguage.found?("the gooks")
      post "/api/admin/language_rules", params: { language_rule: { kind: "allowed", term: "the gooks" } }, as: :json
      assert_response :created
      refute BlockedLanguage.found?("the gooks")
      assert BlockedLanguage.found?("those gooks")
    end
  end

  test "the list is listed, junk is turned away, and the last blocked word stays" do
    sign_in @admin
    with_admins do
      get "/api/admin/language_rules", as: :json
      kinds = response.parsed_body["rules"].map { _1["kind"] }.tally
      assert_operator kinds["word"], :>, 10
      assert_operator kinds["allowed"], :>, 5

      post "/api/admin/language_rules", params: { language_rule: { kind: "word", term: "a(b|c)" } }, as: :json
      assert_response :unprocessable_entity
      post "/api/admin/language_rules", params: { language_rule: { kind: "word", term: "x" } }, as: :json
      assert_response :unprocessable_entity

      LanguageRule.where.not(kind: "allowed").where.not(id: LanguageRule.where(kind: "word").first).delete_all
      delete "/api/admin/language_rules/#{LanguageRule.find_by(kind: 'word').id}", as: :json
      assert_response :unprocessable_entity
    end
  end

  private

  def with_admins
    old = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = @admin.email
    yield
  ensure
    ENV["ADMIN_EMAILS"] = old
  end
end
