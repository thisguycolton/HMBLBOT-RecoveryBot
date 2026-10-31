# Someone with a meeting's Hosting Command Center open: the page checks in every few seconds with
# what they're doing ("Reading the script", "Copied Welcome"), so the other host sees it.
class HostingPresence < ApplicationRecord
  moderates_language :activity
  # Gone from the list once they haven't checked in for this long (a browser checks in less often
  # while the tab is behind Zoom, so this is generous; the page shows "away" much sooner)
  AWAY = 2.minutes

  belongs_to :hosting_session
  belongs_to :user

  before_validation { self.activity = activity.to_s.squish.first(120).presence }

  def as_api_json(viewer)
    { user_id: user_id, name: user.display_name, avatar_url: user.avatar_url, me: user_id == viewer&.id,
      activity: activity, section_index: section_index, last_seen_at: last_seen_at.iso8601 }
  end
end
