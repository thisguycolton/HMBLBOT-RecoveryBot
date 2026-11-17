# Who sees (and hears about) a "Need a sub" request in a group: every member (the default), only
# the people who can host, or nobody but the host coordinators of that meeting. Groups that had
# already marked people as able to host only asked those people, so they start on "hosts" and
# nothing changes for them.
class AddSubRequestsAudienceToGroups < ActiveRecord::Migration[8.0]
  def up
    add_column :groups, :sub_requests_audience, :string, null: false, default: "members"
    execute <<~SQL.squish
      UPDATE groups SET sub_requests_audience = 'hosts'
      WHERE EXISTS (SELECT 1 FROM group_memberships m WHERE m.group_id = groups.id AND m.status = 'active' AND m.can_host)
    SQL
  end

  def down
    remove_column :groups, :sub_requests_audience
  end
end
