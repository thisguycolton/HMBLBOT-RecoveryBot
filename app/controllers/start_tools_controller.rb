# The link at the top of a gratitude list or 10th step someone copied to share (EntryShare
# in components/recovery): /start/gratitude, /start/10th-step. It's the same for everyone and
# carries nothing about who shared it or what they wrote, so the list itself never leaves the
# text they pasted. Signed in, it opens the reader's own page for today; signed out, it's
# remembered while they make an account (or log in), and they land there after.
class StartToolsController < ApplicationController
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  TOOLS = {
    "gratitude" => { path: "/recovery/gratitude", name: "gratitude list" },
    "10th-step" => { path: "/recovery/inventory", name: "10th step" },
  }.freeze

  # GET /start/:tool
  def show
    tool = TOOLS[params[:tool]]
    return redirect_to(root_path) unless tool
    return redirect_to(tool[:path]) if user_signed_in?

    store_location_for(:user, tool[:path])
    redirect_to new_user_registration_path,
                notice: "Someone shared their #{tool[:name]} with you. Sign up to write your own (or log in if you have an account). Only you can ever read it."
  end
end
