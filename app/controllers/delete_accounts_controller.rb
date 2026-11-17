# How to delete an account (/delete-account), a React page: app/javascript/components/site/DeleteAccountPage.jsx.
# Google Play asks for a page like this that can be reached without the app.
class DeleteAccountsController < ApplicationController
  layout "reader"
  allow_search_engines

  def show
    @props = { signedIn: user_signed_in? }
  end
end
