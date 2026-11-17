# Offices (ServicePosition, Manage > Offices) are where a group's roles come from: the secretary is
# a record keeper, the treasurer writes the treasurer's reports, a host coordinator schedules hosts
# (for the whole group, or the weekly meetings the office lists in host_meeting_ids). Whoever holds
# the office now has its role, and loses it when the term passes to someone else or ends, unless
# another office of theirs gives it too. GroupMembership#office_roles remembers which roles came
# from an office; a role given by hand before offices did this (not in office_roles) is left alone
# until an admin turns it into an office. Admins can do everything anyway, so they're left as
# they are.
class OfficeRoles
  ROLES = {
    "can_keep_records" => { label: "record keeper", covers: "the agenda, the minutes and the documents" },
    "can_keep_treasury" => { label: "treasurer", covers: "the treasurer's reports" },
    "can_schedule_hosts" => { label: "host coordinator", covers: "the host schedule" },
  }.freeze

  def self.apply(group, users, roles) = new(group).apply(users, roles)

  # Brings every office holder (and everyone an office gave a role) up to date: terms start and end
  # by date, so this runs once a day per group (Group#sync_office_roles!) and after offices change
  def self.sync!(group)
    holders = group.service_positions.where.not(grants: nil).includes(terms: :user).flat_map { |p| p.terms.map(&:user) }
    given = User.where(id: group.memberships.active.where("cardinality(group_memberships.office_roles) > 0").select(:user_id))
    new(group).apply(holders + given.to_a, ROLES.keys)
  end

  def initialize(group)
    @group = group
    @today = group.zone.today
  end

  # `roles`: the roles that may have changed hands (an office's old and new grants)
  def apply(users, roles)
    roles = roles.compact.uniq & ROLES.keys
    return if roles.empty?

    users.compact.uniq.each do |user|
      membership = @group.membership_for(user)
      next unless membership&.active? && !membership.admin?

      held = offices_held_by(user)
      roles.each { |role| set(membership, role, held.select { |p| p.grants == role }) }
      membership.save! if membership.changed?
    end
  end

  # The weekly meetings at the time an office's title names ("9AM", "12 pm", "6:30 PM"), or nil:
  # what a new host coordinator office starts with
  def self.slot_meeting_ids(group, title)
    match = title.to_s.match(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b/i)
    return unless match

    hour = match[1].to_i % 12 + (match[3].casecmp?("p") ? 12 : 0)
    ids = group.meetings.weekly.where(start_minute: hour * 60 + match[2].to_i).ids
    ids.presence
  end

  private

  def offices_held_by(user)
    @group.service_positions.where(archived: false).where.not(grants: nil).includes(:terms)
          .select { |p| p.current_term(@today)&.user_id == user.id }
  end

  def set(membership, role, offices)
    from_office = membership.office_roles.include?(role)
    if offices.empty?
      return unless from_office # given by hand: left alone

      membership[role] = false
      membership.office_roles = membership.office_roles - [role]
      membership.assign_attributes(host_slots_only: false, host_meeting_ids: []) if role == "can_schedule_hosts"
      return
    end

    membership[role] = true
    membership.office_roles = (membership.office_roles + [role]).uniq unless from_office
    return unless role == "can_schedule_hosts"

    # The meetings their offices cover; any office for the whole group covers everything
    slots = offices.map { |p| p.host_meeting_ids.presence }
    if slots.any?(&:nil?)
      membership.assign_attributes(host_slots_only: false, host_meeting_ids: [])
    else
      membership.assign_attributes(host_slots_only: true, host_meeting_ids: slots.flatten.uniq.sort)
    end
  end
end
