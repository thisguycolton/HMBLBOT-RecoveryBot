# The role on the site an elected office gives whoever holds it (ServicePosition#grants): the
# secretary is a record keeper, the treasurer writes the treasurer's reports, a host coordinator
# schedules hosts. When who holds an office changes, `apply` brings the people involved up to
# date: someone holding an office that grants a role has it, and someone who no longer holds any
# office granting it loses it. Host coordinator offices named for a time ("9AM Host Coordinator")
# cover only the weekly meetings at that time. Admins can do everything anyway, so they're left as
# they are.
class OfficeRoles
  ROLES = {
    "can_keep_records" => { label: "record keeper", covers: "the agenda, the minutes and the documents" },
    "can_keep_treasury" => { label: "treasurer", covers: "the treasurer's reports" },
    "can_schedule_hosts" => { label: "host coordinator", covers: "the host schedule" },
  }.freeze

  def self.apply(group, users, roles) = new(group).apply(users, roles)

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

  # The weekly meetings at the time an office's title names ("9AM", "12 pm", "6:30 PM"), or nil
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
    if offices.empty?
      membership[role] = false
      membership.assign_attributes(host_slots_only: false, host_meeting_ids: []) if role == "can_schedule_hosts"
      return
    end

    was = membership[role]
    membership[role] = true
    return unless role == "can_schedule_hosts"

    slots = offices.map { |p| self.class.slot_meeting_ids(@group, p.title) }
    if slots.any?(&:nil?)
      membership.assign_attributes(host_slots_only: false, host_meeting_ids: [])
    elsif !was || membership.host_slots_only
      membership.assign_attributes(host_slots_only: true, host_meeting_ids: slots.flatten.uniq.sort)
    end
  end
end
