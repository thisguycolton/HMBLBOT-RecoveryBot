# Site Admin > Members: what kinds of devices each member signs in from, and site-wide counts of
# 10th steps and gratitude lists that never name anyone. Built only from what's already stored:
# Ahoy visits (browser and device type, and the app's "RecoveryBotApp/<ver> (iOS|Android)" user
# agent marker), app notification tokens (DeviceToken) and browser push subscriptions.
module MemberStats
  ACTIVE_WITHIN = 30.days

  KINDS = {
    "ios_app" => "iPhone app",
    "android_app" => "Android app",
    "phone_web" => "Phone browser",
    "tablet_web" => "Tablet browser",
    "computer_web" => "Computer browser",
  }.freeze

  VISIT_KIND = <<~SQL.squish.freeze
    CASE
      WHEN user_agent ~ 'RecoveryBotApp/[0-9.]+ \\(iOS\\)' THEN 'ios_app'
      WHEN user_agent ~ 'RecoveryBotApp/[0-9.]+ \\(Android\\)' THEN 'android_app'
      WHEN device_type = 'Tablet' THEN 'tablet_web'
      WHEN device_type = 'Mobile' THEN 'phone_web'
      ELSE 'computer_web'
    END
  SQL

  # Histogram buckets for "how many has each person written", lowest first
  BUCKETS = [[1, 1], [2, 4], [5, 9], [10, 29], [30, 99], [100, nil]].freeze

  module_function

  # { user_id => [{ kind:, label:, last_seen_at:, active:, push: }] }, most recent first
  def devices_for(user_ids, now: Time.current)
    seen = Hash.new { |h, k| h[k] = {} }
    note = lambda do |uid, kind, at, push: false|
      d = (seen[uid][kind] ||= { kind: kind, label: KINDS[kind], last_seen_at: nil, push: false })
      d[:last_seen_at] = at if at && (d[:last_seen_at].nil? || at > d[:last_seen_at])
      d[:push] ||= push
    end

    Ahoy::Visit.where(user_id: user_ids).group(:user_id, Arel.sql(VISIT_KIND)).maximum(:started_at)
               .each { |(uid, kind), at| note.(uid, kind, at) }
    DeviceToken.where(user_id: user_ids).find_each do |t|
      note.(t.user_id, "#{t.platform}_app", t.updated_at, push: true)
    end
    PushSubscription.where(user_id: user_ids).find_each do |s|
      note.(s.user_id, browser_kind(s.user_agent), s.updated_at, push: true)
    end

    seen.transform_values do |by_kind|
      by_kind.values.map do |d|
        d.merge(active: d[:last_seen_at].present? && d[:last_seen_at] >= now - ACTIVE_WITHIN, last_seen_at: d[:last_seen_at]&.iso8601)
      end.sort_by { |d| d[:last_seen_at].to_s }.reverse
    end
  end

  def browser_kind(user_agent)
    case user_agent.to_s
    when /iPad|Tablet/i then "tablet_web"
    when /Mobile|iPhone|Android/i then "phone_web"
    else "computer_web"
    end
  end

  # The whole site's figures, never filtered by the Members search, so a count can't be narrowed
  # down to one named person.
  def summary(now: Time.current)
    {
      steps: writing(StepInventory, now),
      gratitude: writing(GratitudeList, now),
      devices: device_summary(now),
      day_counts: day_counts(now.to_date),
    }
  end

  # How many there are, how many people wrote one, and how many each person wrote, as a
  # histogram and a few figures (median, most by one person) with nobody attached
  def writing(model, now)
    per_person = model.group(:user_id).count.values.sort
    {
      total: per_person.sum,
      last_30_days: model.where(on: (now.to_date - 29)..now.to_date).count,
      people: per_person.size,
      people_last_30_days: model.where(on: (now.to_date - 29)..now.to_date).distinct.count(:user_id),
      median: median(per_person),
      most: per_person.last || 0,
      buckets: BUCKETS.map do |lo, hi|
        { label: hi.nil? ? "#{lo}+" : (lo == hi ? lo.to_s : "#{lo}–#{hi}"), people: per_person.count { |n| n >= lo && (hi.nil? || n <= hi) } }
      end,
    }
  end

  def median(sorted)
    return 0 if sorted.empty?
    mid = sorted.size / 2
    sorted.size.odd? ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2.0).round(1)
  end

  # People per device kind: ever, and active in the last 30 days
  def device_summary(now)
    ever = Hash.new { |h, k| h[k] = Set.new }
    active = Hash.new { |h, k| h[k] = Set.new }
    since = now - ACTIVE_WITHIN
    add = lambda do |uid, kind, at|
      ever[kind] << uid
      active[kind] << uid if at && at >= since
    end
    Ahoy::Visit.where.not(user_id: nil).group(:user_id, Arel.sql(VISIT_KIND)).maximum(:started_at).each { |(uid, kind), at| add.(uid, kind, at) }
    DeviceToken.pluck(:user_id, :platform, :updated_at).each { |uid, platform, at| add.(uid, "#{platform}_app", at) }
    PushSubscription.pluck(:user_id, :user_agent, :updated_at).each { |uid, ua, at| add.(uid, browser_kind(ua), at) }
    KINDS.map { |kind, label| { kind: kind, label: label, people: ever[kind].size, active: active[kind].size } }
  end

  # Day counts without names: how many members have a sobriety date, a spread of how long, and
  # which fun day-count facts (app/javascript/lib/dayFacts.json) members pass in the next week
  def day_counts(today)
    counts = User.where.not(sobriety_date: nil).pluck(:sobriety_date).map { |d| (today - d).to_i }.select { |n| n >= 0 }
    spans = [["Under 30 days", 0, 29], ["30–89 days", 30, 89], ["90 days to 1 year", 90, 364], ["1–5 years", 365, 1825], ["5–10 years", 1826, 3652], ["10+ years", 3653, nil]]
    week = facts.flat_map do |f|
      (0..6).filter_map do |ahead|
        n = counts.count { |c| c + ahead == f["days"] }
        { days: f["days"], title: f["title"], topic: f["topic"], in_days: ahead, people: n } if n.positive?
      end
    end
    {
      with_date: counts.size,
      spans: spans.map { |label, lo, hi| { label: label, people: counts.count { |c| c >= lo && (hi.nil? || c <= hi) } } },
      facts_this_week: week.sort_by { |w| [w[:in_days], w[:days]] },
    }
  end

  def facts
    @facts ||= JSON.parse(File.read(Rails.root.join("app/javascript/lib/dayFacts.json")))
  end
end
