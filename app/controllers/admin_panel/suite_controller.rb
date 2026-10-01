# The admin suite (User#suite_admin? only): one React app (entrypoints/admin_suite.jsx) for the
# overview, Ahoy analytics, users, readings, tags and court verifications. Every path under
# /admin_panel that isn't routed elsewhere renders it; it routes on the client.
module AdminPanel
  class SuiteController < ApplicationController
    include AdminSuiteAccess
    layout "reader"

    def show; end
  end
end
