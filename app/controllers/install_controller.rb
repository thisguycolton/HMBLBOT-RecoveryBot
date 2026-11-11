# How to put RecoveryBot on your home screen and turn on notifications (/install), a React page:
# app/javascript/components/site/InstallPage.jsx
class InstallController < ApplicationController
  layout "reader"
  allow_search_engines

  def show
    # The iPhone and Android apps are already installed, and their notifications are their own
    return redirect_to "/" if native_app?

    @props = { push: WebPushSender.configured? }
  end
end
