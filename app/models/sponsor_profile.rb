# "Available to sponsor": someone saying they can take on a sponsee, with a note in their own
# words and picks from PICKS (who they'll sponsor, where people are, how they work). Off
# until they turn it on, and only ever shown to people in a group with them, in groups that
# haven't turned the list off (groups.show_sponsors), on Sponsorship > Find a sponsor. Never
# to anyone signed out or outside their groups.
#
# Anyone whose account is at least a week old can offer; we don't check sobriety dates. When
# they're full (max_sponsees active sponsees) they stop showing. People ask them the usual way
# (Sponsorship.ask!), which they can say yes or no to. A site admin can stop someone offering
# (stopped_at), after a report for instance; they can't turn it back on themselves.
class SponsorProfile < ApplicationRecord
  moderates_language :note, :picks, :languages

  # Colton's list (2026-10-31), trimmed by him
  PICKS = {
    "Who" => ["Men", "Women", "Nonbinary people", "LGBTQ+ folks", "Anyone"],
    "Where they are" => ["Newcomers (just getting started)", "People coming back after a relapse", "People looking for a temporary sponsor",
                         "People who want to go through the steps with a step study", "People who already have a sponsor and want a service sponsor",
                         "People in treatment or sober living", "People going to meetings for court or work"],
    "Background" => ["Young people", "Older adults", "Veterans", "Atheists, agnostics and freethinkers", "People in other Twelve Step programs too",
                     "People with a dual diagnosis", "Chronic relapsers"],
    "How" => ["In person", "Phone", "Video", "Online meetings only"],
  }.freeze
  ALL_PICKS = PICKS.values.flatten.freeze
  ACCOUNT_AGE = 1.week
  NOTE_MAX = 600

  belongs_to :user
  belongs_to :stopped_by, class_name: "User", optional: true

  validates :note, length: { maximum: NOTE_MAX }
  validates :languages, length: { maximum: 120 }
  validates :max_sponsees, numericality: { in: 1..50 }, allow_nil: true
  validate { errors.add(:base, "You can offer once your account is a week old.") if available && !self.class.old_enough?(user) }
  validate { errors.add(:base, "A site admin has turned this off for your account.") if available && stopped_at && will_save_change_to_available? }

  before_validation do
    self.note = note.to_s.strip.presence
    self.picks = Array(picks).map(&:to_s) & ALL_PICKS
    self.languages = languages.to_s.squish.presence
  end

  def self.old_enough?(user) = user.created_at <= ACCOUNT_AGE.ago
  def self.for(user) = find_or_initialize_by(user: user)

  def active_sponsees = Sponsorship.active.where(sponsor_id: user_id).count
  def full? = max_sponsees.present? && active_sponsees >= max_sponsees
  def listed? = available && stopped_at.nil? && self.class.old_enough?(user) && !full?

  # Who `viewer` can see offering: in their groups (that list sponsors), not themselves, not
  # blocked either way, and still able to take someone on. { profile => [group titles] }
  def self.visible_to(viewer)
    groups = viewer.groups.where(show_sponsors: true).to_a
    return {} if groups.empty?

    memberships = GroupMembership.active.where(group: groups).where.not(user_id: viewer.id).pluck(:user_id, :group_id)
    titles = groups.to_h { |g| [g.id, g.title] }
    by_user = memberships.group_by(&:first).transform_values { |rows| rows.map { |_, g| titles[g] }.uniq }
    blocked = UserBlock.where(blocker: viewer).pluck(:blocked_id) + UserBlock.where(blocked: viewer).pluck(:blocker_id)
    where(user_id: by_user.keys - blocked, available: true, stopped_at: nil).includes(:user).select(&:listed?)
      .sort_by { |p| p.user.display_name.downcase }.to_h { |p| [p, by_user[p.user_id]] }
  end

  # How long sober, as they'd say it, when they choose to show it
  def time_sober
    date = user.sobriety_date
    return unless show_time_sober && date && date <= Date.current

    months = (Date.current.year * 12 + Date.current.month) - (date.year * 12 + date.month) - (Date.current.day < date.day ? 1 : 0)
    return "#{(Date.current - date).to_i} days" if months < 3
    return "#{months} months" if months < 24

    "#{months / 12} years"
  end

  def body = note # for reports (UserReport keeps a quote of it)

  def as_card_json(groups)
    { id: id, person: user.as_person_json, note: note, picks: picks, languages: languages, time_sober: time_sober, groups: groups }
  end

  def as_settings_json
    {
      available: available, note: note, picks: picks, languages: languages, show_time_sober: show_time_sober, max_sponsees: max_sponsees,
      stopped: stopped_at.present?, old_enough: self.class.old_enough?(user), has_sobriety_date: user.sobriety_date.present?,
      time_sober: (time_sober if show_time_sober), active_sponsees: active_sponsees, full: full?,
      can_start_on: (user.created_at + ACCOUNT_AGE).to_date.iso8601,
    }
  end
end
