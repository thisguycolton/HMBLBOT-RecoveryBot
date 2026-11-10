# How to put RecoveryBot on your home screen and turn on notifications (/install), a React page:
# app/javascript/components/site/InstallPage.jsx
class InstallController < ApplicationController
  layout "reader"
  allow_search_engines

  def show
    @props = { push: WebPushSender.configured? }
  end
end
