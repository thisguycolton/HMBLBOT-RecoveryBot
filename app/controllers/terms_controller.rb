# The terms of use (/terms), a React page: app/javascript/components/site/TermsPage.jsx
class TermsController < ApplicationController
  layout "reader"
  allow_search_engines

  def show
    @props = {}
  end
end
