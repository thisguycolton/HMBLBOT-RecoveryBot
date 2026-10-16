# app/controllers/court_verifications_controller.rb
class CourtVerificationsController < ApplicationController
  layout "reader", only: %i[new]
  # Not linked from anywhere public: hosts share the URL directly, and search engines are told to skip it
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  # ?group=<slug> makes it that group's form: its name, its meetings, its time zone.
  # Group links are shared by the group's admins, like the plain one.
  def new
    @group = Group.active.find_by(slug: params[:group].to_s) if params[:group].present?
    @group_json = @group && group_form_json(@group)
  end

  private

  # Each meeting with the dates it falls on today and yesterday (in the group's zone),
  # so the form can offer the right ones for the day picked
  def group_form_json(group)
    today = group.zone.today
    days = [today - 1, today]
    meetings = group.meetings.ordered.filter_map do |m|
      starts = days.filter_map { |d| m.start_on(d) }
      next if starts.empty?

      { id: m.id, name: m.name, dates: starts.map { |t| t.to_date.iso8601 }, time_label: starts.first.strftime("%-I:%M %p %Z") }
    end
    { slug: group.slug, title: group.title, today: today.iso8601, meetings: meetings,
      time_zone_label: "#{group.time_zone.split('/').last.tr('_', ' ')} time (#{group.zone.now.strftime('%Z')})" }
  end
end
