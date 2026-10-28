# The link in a chip's email (ChipMailer): signed in, the chip is theirs and their Chips page
# opens on it; signed out, it waits in a cookie while they make an account or log in
# (ApplicationController#after_sign_in_path_for picks it up).
class ChipsController < ApplicationController
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  # GET /chips/claim/:token
  def claim
    award = ChipAward.find_by(claim_token: params[:token].to_s)
    return redirect_to(root_path, alert: "That chip link doesn't work anymore. Ask whoever sent it.") unless award
    return redirect_to(ClaimsChip.call(current_user, award) || "/recovery") if user_signed_in?

    cookies.signed[:chip_claim] = { value: award.claim_token, expires: 30.days, httponly: true }
    redirect_to new_user_registration_path, notice: "#{award.group.title} sent you a #{award.label} chip. Make an account (or log in) to claim it."
  end
end
