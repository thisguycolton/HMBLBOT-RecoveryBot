# The profile page (/users/edit), a React page: app/javascript/entrypoints/profile.jsx
class ProfilesController < ApplicationController
  layout "reader"
  before_action :authenticate_user!

  def show; end
end
