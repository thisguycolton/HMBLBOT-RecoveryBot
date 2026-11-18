# One build of the iPhone or Android app (mobile/), with its release notes. A build with no
# released_on is made but not out to testers yet, so nobody is told to update to it. Kept in
# Site Admin > App releases; shown in Account settings > App info (Api::AppInfoController), and
# Site Admin > Site notices starts "how to update" notices from the latest one out (UPDATE_STEPS).
class AppRelease < ApplicationRecord
  PLATFORMS = %w[ios android].freeze
  PLATFORM_NAMES = { "ios" => "iPhone", "android" => "Android" }.freeze

  TESTFLIGHT_URL = "https://testflight.apple.com/join/fCjuQmFW"
  PLAY_TESTING_URL = "https://play.google.com/apps/testing/com.hmblbot.recoverybot"
  PLAY_URL = "https://play.google.com/store/apps/details?id=com.hmblbot.recoverybot"

  # How testers update, per platform: a notice to start from (Site Admin > Site notices) and the
  # steps App info shows when a newer build is out. "%{build}" becomes the build number.
  UPDATE_STEPS = {
    "ios" => {
      title: "Update RecoveryBot for iPhone",
      summary: "Build %{build} is ready in TestFlight. Updating takes about a minute.",
      link_url: TESTFLIGHT_URL,
      link_label: "Open TestFlight",
      body: <<~MD,
        A new test build of the iPhone app (build %{build}) is out. You got RecoveryBot through **TestFlight**, so that's where it updates too. You stay signed in.

        1. Open the **TestFlight** app on your iPhone. It has a blue propeller icon.
        2. Under **Apps**, tap **RecoveryBot**.
        3. Tap **Update**. If it says **Open** instead, pull down on the page to check again.
        4. Open RecoveryBot. **Account settings > App info** should say build %{build}.

        **Never think about it again:** in TestFlight, tap RecoveryBot and turn on **Automatic Updates**.

        **Don't see RecoveryBot in TestFlight, or it says the build expired?** Tap **Open TestFlight** below to open the invite again, then tap **Install** or **Update**.
      MD
    },
    "android" => {
      title: "Update RecoveryBot for Android",
      summary: "Build %{build} is ready in Google Play. Updating takes about a minute.",
      link_url: PLAY_URL,
      link_label: "Open in Google Play",
      body: <<~MD,
        A new test build of the Android app (build %{build}) is out in **Google Play**. You stay signed in.

        1. Open the **Google Play Store** app.
        2. Tap your profile picture at the top right, then **Manage apps & device**.
        3. Tap **Updates available**, find **RecoveryBot** and tap **Update**. You can also search for RecoveryBot in Play and tap **Update** on its page.
        4. Open RecoveryBot. **Account settings > App info** should say build %{build}.

        **Never think about it again:** on RecoveryBot's page in Play, tap the **⋮** menu at the top right and check **Enable auto update**.

        **No update showing?** A new test build can take a few hours to reach everyone. Open [the testing page](#{PLAY_TESTING_URL}) signed in to the same Google account you use in Play, make sure it says you're a tester, then check Play again.
      MD
    },
  }.freeze

  validates :platform, inclusion: { in: PLATFORMS }
  validates :build, numericality: { only_integer: true, greater_than: 0 }, uniqueness: { scope: :platform }
  validates :version, presence: true, length: { maximum: 20 }
  validates :notes, length: { maximum: 4000 }

  scope :released, -> { where.not(released_on: nil) }
  scope :newest_first, -> { order(build: :desc) }

  def self.latest(platform) = released.where(platform: platform).newest_first.first

  # The notice (or App info's steps) for updating to this build
  def update_steps
    steps = UPDATE_STEPS.fetch(platform)
    steps.transform_values { |text| format(text, build: build) }
  end

  def released? = released_on.present?

  def label = "#{PLATFORM_NAMES[platform]} #{version} (build #{build})"

  def as_api_json
    { platform: platform, build: build, version: version, notes: notes.presence, released_on: released_on&.iso8601 }
  end

  def as_admin_json = as_api_json.merge(id: id, released: released?)
end
