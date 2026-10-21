# How to put RecoveryBot on your home screen and turn on notifications (/install), a React page:
# app/javascript/components/site/InstallPage.jsx
class InstallController < ApplicationController
  layout "reader"

  def show
    @props = { push: WebPushSender.configured? }
  end
end
