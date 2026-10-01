# Ahoy analytics for the admin suite. GET ?days=7|30|90 (default 30). Days are Phoenix days.
# Every query is bounded to the window: visits by started_at, events by (name, time).
class Api::Admin::AnalyticsController < Api::Admin::SuiteController
  RANGES = [7, 30, 90].freeze
  TOP = 10

  def show
    days = RANGES.include?(params[:days].to_i) ? params[:days].to_i : 30
    zone = Time.find_zone!(CourtVerification::TIME_ZONE)
    since = zone.now.beginning_of_day - (days - 1).days
    visits = Ahoy::Visit.where(started_at: since..)
    events = Ahoy::Event.where(time: since..)

    render json: {
      days: days,
      since: since.to_date.iso8601,
      totals: {
        visits: visits.count,
        visitors: visits.distinct.count(:visitor_token),
        signed_in_visitors: visits.where.not(user_id: nil).distinct.count(:user_id),
        events: events.count,
      },
      new_vs_returning: new_vs_returning(visits, since),
      daily: daily(visits, since, days, zone),
      # pages people opened: API calls (the quest game, admin screens) and admin pages are left out
      top_pages: top(events.where(name: "Ran action")
                           .where("JSONB_EXISTS(properties, 'controller')")
                           .where("properties->>'controller' NOT LIKE 'api/%' AND properties->>'controller' NOT LIKE 'admin_panel/%'"),
                     "CONCAT(properties->>'controller', '#', properties->>'action')"),
      top_events: top(events, "name"),
      top_readings: top(events.where(name: "Viewed Reading"), "properties->>'title'"),
      referrers: top(visits.where.not(referring_domain: [nil, ""]), "referring_domain"),
      landing_pages: top(visits.where.not(landing_page: [nil, ""]), "split_part(landing_page, '?', 1)"),
      devices: top(visits, "COALESCE(NULLIF(device_type, ''), 'Unknown')"),
      browsers: top(visits, "COALESCE(NULLIF(browser, ''), 'Unknown')"),
      operating_systems: top(visits, "COALESCE(NULLIF(os, ''), 'Unknown')"),
      countries: top(visits.where.not(country: [nil, ""]), "country"),
      cities: top(visits.where.not(city: [nil, ""]), "CONCAT(city, ', ', COALESCE(NULLIF(region, ''), country))"),
    }
  end

  private

  # [{ label:, count: }] for the most common values of a SQL expression
  def top(scope, expression)
    scope.group(Arel.sql(expression)).order(Arel.sql("COUNT(*) DESC")).limit(TOP).count
         .map { |label, count| { label: label.to_s, count: count } }
  end

  # One row per day, oldest first, zero-filled
  def daily(visits, since, days, zone)
    day = Arel.sql("DATE(started_at AT TIME ZONE 'UTC' AT TIME ZONE #{ActiveRecord::Base.connection.quote(zone.tzinfo.name)})")
    counts = visits.group(day).pluck(day, Arel.sql("COUNT(*)"), Arel.sql("COUNT(DISTINCT visitor_token)"))
                   .to_h { |date, v, u| [date.to_date, [v, u]] }
    (0...days).map do |i|
      date = since.to_date + i
      v, u = counts.fetch(date, [0, 0])
      { date: date.iso8601, visits: v, visitors: u }
    end
  end

  # Visitors in the window who had (returning) or hadn't (new) visited before it
  def new_vs_returning(visits, since)
    tokens = visits.where.not(visitor_token: nil).distinct.select(:visitor_token)
    returning = Ahoy::Visit.where(visitor_token: tokens).where(started_at: ...since).distinct.count(:visitor_token)
    total = visits.where.not(visitor_token: nil).distinct.count(:visitor_token)
    { new: total - returning, returning: returning }
  end
end
