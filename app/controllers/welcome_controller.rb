# The welcome wizard (/welcome, a React page: app/javascript/components/welcome/WelcomeWizard.jsx).
# A new account lands here after signing in for the first time, by email, Google or Apple, on
# the website or in the apps (ApplicationController#after_sign_in_path_for): find your group,
# then an optional short tour. Finishing or skipping it sets users.onboarded_at, so it shows
# once. Anyone can open it again later (?tour=1 starts at the tour).
class WelcomeController < ApplicationController
  layout "reader"
  before_action :authenticate_user!
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  # /welcome, remembering where to go after it (a page on this site only)
  def self.path(next_path: nil)
    next_path = safe_next(next_path)
    next_path ? "/welcome?#{{ next: next_path }.to_query}" : "/welcome"
  end

  def self.safe_next(path)
    path = path.to_s
    return unless path.start_with?("/") && !path.start_with?("//") && !path.include?("\\")
    return if path.start_with?("/welcome", "/users/", "/api/")

    path
  end

  def show
    flash.delete(:notice) # "Signed in successfully." would sit over the welcome itself
    memberships = current_user.group_memberships.includes(group: { logo_attachment: :blob }).order(:created_at)
    @props = {
      name: current_user.name.to_s.split.first || current_user.display_name,
      first_time: current_user.onboarding_due?,
      start: params[:tour] == "1" ? "tour" : "group",
      groups_open: Group.feature_open_to?(current_user),
      next: self.class.safe_next(params[:next]) || (User.profiles_open_to?(current_user) ? "/people" : "/"),
      my_groups: memberships.map { |m| { slug: m.group.slug, title: m.group.title, status: m.status } },
    }
  end
end
