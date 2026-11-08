# Site Admin > Daily story's "Connect Facebook Page": off to Facebook's sign-in, and back here
# with a code that becomes a Page token (MetaGraph) for the daily Story (DailyStory). When
# the account manages several Pages, the admin page asks which.
module AdminPanel
  class FacebookController < ApplicationController
    include AdminSuiteAccess

    PAGE = "/admin_panel/daily_story"

    # GET /admin_panel/facebook/connect?instagram=1
    def connect
      return redirect_to("#{PAGE}?error=#{CGI.escape('Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET first.')}") unless MetaGraph.configured?

      session[:facebook_state] = SecureRandom.hex(16)
      redirect_to MetaGraph.dialog_url(redirect_uri: callback_url, state: session[:facebook_state], instagram: params[:instagram] == "1"),
                  allow_other_host: true
    end

    # GET /admin_panel/facebook/callback?code=&state=
    def callback
      state = session.delete(:facebook_state)
      return back("Facebook sign-in didn't finish.") if params[:error].present? || params[:code].blank?
      return back("That sign-in link was old or not ours. Please try again.") unless state.present? && ActiveSupport::SecurityUtils.secure_compare(state, params[:state].to_s)

      token = MetaGraph.user_token(code: params[:code], redirect_uri: callback_url)
      pages = MetaGraph.pages(token)
      connection = FacebookPageConnection.current
      case pages.size
      when 0 then back("That Facebook account doesn't manage a Page it can post to.")
      when 1
        connection.connect!(pages.first, user: current_user)
        redirect_to "#{PAGE}?connected=1"
      else
        connection.update!(page_choices: pages)
        redirect_to "#{PAGE}?choose=1"
      end
    rescue MetaGraph::Error, SocketError, SystemCallError, Net::OpenTimeout, Net::ReadTimeout, OpenSSL::SSL::SSLError => e
      back("Facebook said: #{e.message}")
    end

    private

    def callback_url = admin_panel_facebook_callback_url

    def back(message) = redirect_to("#{PAGE}?error=#{CGI.escape(message)}")
  end
end
