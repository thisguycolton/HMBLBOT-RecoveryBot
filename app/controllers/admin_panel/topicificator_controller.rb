# The Topicificator admin: a React app (entrypoints/topicificator_admin.jsx) for topics,
# topic sets and categories, plus ACID QUEST curation (difficulty, tags, per-topic prompts).
# Every path under /admin_panel/topicificator renders the app; it routes on the client.
module AdminPanel
  class TopicificatorController < ApplicationController
    layout "reader"
    before_action :authenticate_user!
    before_action -> { redirect_to root_path, alert: "Access denied!" unless current_user.admin? }

    def show; end
  end
end
