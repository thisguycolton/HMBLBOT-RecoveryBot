# Account settings > App info: the app builds that are out and their release notes, and how
# testers update (AppRelease). Public, since there's nothing private in it.
class Api::AppInfoController < ApplicationController
  # GET /api/app_info
  def show
    releases = AppRelease.released.newest_first.to_a
    render json: {
      platform: native_platform || "web",
      releases: releases.map(&:as_api_json),
      latest: AppRelease::PLATFORMS.index_with { |p| releases.find { |r| r.platform == p }&.build },
      update_steps: AppRelease::PLATFORMS.index_with { |p| releases.find { |r| r.platform == p }&.update_steps },
    }
  end
end
