# Offices (service positions) become the one place a group's roles come from (Manage > Offices).
# - service_positions.host_meeting_ids: the weekly meetings a host coordinator office covers
#   (empty: the whole group). Each gets the time slots its holder coordinates now (the old
#   per-person grid), or else the meetings at the time its title names ("9AM Host Coordinator"),
#   which is what it covered before.
# - group_memberships.office_roles: which of a member's roles an office gave them, so they end
#   with the term. Roles given by hand before this (not backed by an office) keep working and are
#   listed in Manage > Offices to turn into offices; nothing is taken away.
# - groups.office_roles_synced_on: the day a group's office roles were last brought up to date
#   (terms start and end by date, and there's no job runner, so the first visit of a day does it).
class MakeOfficesTheSourceOfRoles < ActiveRecord::Migration[8.0]
  def up
    add_column :service_positions, :host_meeting_ids, :bigint, array: true, null: false, default: []
    add_column :group_memberships, :office_roles, :string, array: true, null: false, default: []
    add_column :groups, :office_roles_synced_on, :date

    say_with_time "Backfilling office slots and office roles" do
      Group.reset_column_information
      ServicePosition.reset_column_information
      GroupMembership.reset_column_information
      ServicePosition.where(grants: "can_schedule_hosts").includes(:group, :terms).find_each do |position|
        # What the holder coordinates today (their own time slots, picked in the old per-person
        # grid) comes first, so nobody's slots change; else the time in the office's title
        holder = position.current_term(position.group.zone.today)&.user_id
        membership = holder && position.group.memberships.find_by(user_id: holder, status: "active")
        ids = (membership.host_meeting_ids.presence if membership&.can_schedule_hosts && membership.host_slots_only && membership.role != "admin")
        ids ||= OfficeRoles.slot_meeting_ids(position.group, position.title)
        position.update_columns(host_meeting_ids: ids) if ids
      end
      ServicePosition.where(archived: false).where.not(grants: nil).includes(:group, :terms).find_each do |position|
        term = position.current_term(position.group.zone.today)
        next unless term&.user_id

        membership = position.group.memberships.find_by(user_id: term.user_id, status: "active")
        next if membership.nil? || membership.role == "admin" || !membership[position.grants]
        next if membership.office_roles.include?(position.grants)

        membership.update_columns(office_roles: membership.office_roles + [position.grants])
      end
    end
  end

  def down
    remove_column :groups, :office_roles_synced_on
    remove_column :group_memberships, :office_roles
    remove_column :service_positions, :host_meeting_ids
  end
end
