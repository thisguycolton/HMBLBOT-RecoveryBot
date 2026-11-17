# The privacy policy (/privacy), a React page: app/javascript/components/site/PrivacyPage.jsx
class PrivacyController < ApplicationController
  layout "reader"
  allow_search_engines

  def show
    @props = { turnstile: HumanCheck.turnstile_site_key.present?, google: GoogleSignIn.enabled? }
  end
end
