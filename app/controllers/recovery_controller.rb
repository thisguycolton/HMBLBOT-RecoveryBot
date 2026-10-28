# The page that holds a member's own recovery tools (/recovery: chips, 10th step, gratitude),
# a React app: app/javascript/entrypoints/recovery.jsx. Signed-in only, never indexed.
class RecoveryController < ApplicationController
  layout "reader"
  before_action :authenticate_user!
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  def app; end
end
