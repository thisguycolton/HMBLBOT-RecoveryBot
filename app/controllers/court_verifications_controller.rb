# app/controllers/court_verifications_controller.rb
class CourtVerificationsController < ApplicationController
  layout "reader", only: %i[new]
  # Not linked from anywhere public: hosts share the URL directly, and search engines are told to skip it
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  # ?group=<slug> makes it that group's form: its name, its meetings, its time zone.
  # Group links are shared by the group's admins, like the plain one. &meeting=<id> (from a
  # host's account menu) picks that meeting, on whichever of today and yesterday it ran.
  def new
    @group = Group.active.find_by(slug: params[:group].to_s) if params[:group].present?
    @group_json = @group && group_form_json(@group)
    @group_json&.merge!(preselect: preselect(@group, @group_json)) if params[:meeting].present?
  end

  private

  # { meeting_id:, day: "today" | "yesterday", host_name: } for the meeting (any of its days) on
  # the latest of today and yesterday it ran, and the host's name when they're signed in
  def preselect(group, json)
    meeting = group.meetings.find_by(id: params[:meeting])
    return unless meeting

    ids = meeting.series.pluck(:id)
    today = json[:today]
    yesterday = (Date.iso8601(today) - 1).iso8601
    day, hit = [["today", today], ["yesterday", yesterday]].lazy.filter_map do |label, date|
      m = json[:meetings].find { |x| ids.include?(x[:id]) && x[:dates].include?(date) }
      [label, m] if m
    end.first
    { meeting_id: hit&.dig(:id), day: day, name: meeting.name, host_name: current_user&.display_name }.compact
  end

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
      email: group.court_email_json.slice(:subject, :body, :fields),
      time_zone_label: "#{group.time_zone.split('/').last.tr('_', ' ')} time (#{group.zone.now.strftime('%Z')})" }
  end
end
