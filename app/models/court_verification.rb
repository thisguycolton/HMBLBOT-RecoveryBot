class CourtVerification < ApplicationRecord
  # Meetings are in Phoenix; letters, filters and exports all use its time
  TIME_ZONE = "America/Phoenix".freeze

  validates :respondent_name, :respondent_email, :meeting_at, :host_name, presence: true
  validates :respondent_email, format: { with: URI::MailTo::EMAIL_REGEXP }

  # Admin lookup. name/email match anywhere, ignoring case; from/to are "YYYY-MM-DD" days in
  # Phoenix, both inclusive. Blank or unparseable values don't filter.
  def self.filtered(name: nil, email: nil, from: nil, to: nil)
    scope = all
    scope = scope.where("respondent_name ILIKE ?", "%#{sanitize_sql_like(name.strip)}%") if name.present?
    scope = scope.where("respondent_email ILIKE ?", "%#{sanitize_sql_like(email.strip)}%") if email.present?
    if (day = parse_day(from))
      scope = scope.where(meeting_at: day.beginning_of_day..)
    end
    if (day = parse_day(to))
      scope = scope.where(meeting_at: ..day.end_of_day)
    end
    scope
  end

  # "2026-08-14" -> midnight that day in Phoenix, or nil
  def self.parse_day(value)
    Date.iso8601(value.to_s).in_time_zone(TIME_ZONE) if value.present?
  rescue Date::Error
    nil
  end

  # "Thursday, August 14, 2026 at 7:00 PM MST", as in the verification email
  def meeting_time_label
    meeting_at.in_time_zone(TIME_ZONE).strftime("%A, %B %-d, %Y at %-I:%M %p %Z")
  end

  def as_admin_json
    {
      id: id,
      respondent_name: respondent_name,
      respondent_email: respondent_email,
      meeting_at: meeting_at.in_time_zone(TIME_ZONE).iso8601,
      meeting_time_label: meeting_time_label,
      topic: topic,
      host_name: host_name,
      signer_name: signer_name,
      created_at: created_at.iso8601,
    }
  end
end
