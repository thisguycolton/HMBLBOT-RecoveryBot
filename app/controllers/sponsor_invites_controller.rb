# A sponsor's invite link (/sponsor/:token, Api::SponsorshipsController#invite). Signed in,
# it opens Sponsorship with the invite to accept; signed out, it's remembered while they make
# an account (or log in), as the shared-list links are (StartToolsController).
class SponsorInvitesController < ApplicationController
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  # GET /sponsor/:token
  def show
    path = "/recovery/sponsorship?invite=#{CGI.escape(params[:token].to_s)}"
    return redirect_to(path) if user_signed_in?

    store_location_for(:user, path)
    redirect_to new_user_registration_path, notice: "Sign up to accept your sponsor's invite (or log in if you have an account)."
  end
end
