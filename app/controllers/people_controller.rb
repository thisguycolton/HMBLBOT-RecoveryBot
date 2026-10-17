# The page that holds profiles (/people, /people/:username), a React app:
# app/javascript/entrypoints/people.jsx. Signed-in only, never indexed.
class PeopleController < ApplicationController
  layout "reader"
  before_action :authenticate_user!
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  def app
    redirect_to root_path, alert: "Profiles aren't open yet." unless User.profiles_open_to?(current_user)
  end
end
