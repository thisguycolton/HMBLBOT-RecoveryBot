# The privacy policy (/privacy), a React page: app/javascript/components/site/PrivacyPage.jsx
class PrivacyController < ApplicationController
  layout "reader"

  def show
    @props = { turnstile: HumanCheck.turnstile_site_key.present?, contact_configured: ContactMailer.recipients.any? }
  end
end
