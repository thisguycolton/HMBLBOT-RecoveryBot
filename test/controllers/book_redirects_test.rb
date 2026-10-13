require "test_helper"

class BookRedirectsTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  test "/books/<slug> goes to the book's library page" do
    get "/books/alcoholics-anonymous"
    assert_redirected_to "/library/alcoholics-anonymous"
  end

  test "/books goes to the library" do
    get "/books"
    assert_redirected_to "/library"
  end
end
