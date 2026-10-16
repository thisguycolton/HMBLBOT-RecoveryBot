# Carries the first groups attempt's data into the new shape. The old columns
# (groups.location/remote/meetingLink, meetings.datetime/host/reocurring/frequency) stay
# for now so nothing is lost; the app no longer reads them.
class MoveOldGroupData < ActiveRecord::Migration[8.0]
  ZONE = "America/Phoenix".freeze

  def up
    taken = []
    select_rows("SELECT id, title FROM groups ORDER BY id").each do |id, title|
      base = title.to_s.parameterize.presence || "group"
      slug = base
      n = 1
      slug = "#{base}-#{n += 1}" while taken.include?(slug)
      taken << slug
      execute "UPDATE groups SET slug = #{quote(slug)}, join_token = #{quote(SecureRandom.alphanumeric(12).downcase)} WHERE id = #{id}"
    end

    # Anyone who set a group as their active group, or tagged a reading to one, is a member
    execute <<~SQL
      INSERT INTO group_memberships (group_id, user_id, role, status, created_at, updated_at)
      SELECT DISTINCT group_id, user_id, 'member', 'active', NOW(), NOW() FROM (
        SELECT group_id, user_id FROM user_active_groups
        UNION SELECT group_id, user_id FROM readings WHERE group_id IS NOT NULL AND user_id IS NOT NULL
      ) pairs
      WHERE group_id IN (SELECT id FROM groups) AND user_id IN (SELECT id FROM users)
      ON CONFLICT DO NOTHING
    SQL

    zone = ActiveSupport::TimeZone[ZONE]
    select_rows("SELECT m.id, m.datetime, m.host, m.reocurring, g.\"meetingLink\", g.title FROM meetings m JOIN groups g ON g.id = m.group_id").each do |id, datetime, host, recurring, link, title|
      at = datetime && Time.zone.parse(datetime.to_s)&.in_time_zone(zone)
      attrs = { name: title, notes: (host.present? ? "Host: #{host}" : nil), conference_url: link.presence, time_zone: ZONE }
      if at && ActiveModel::Type::Boolean.new.cast(recurring)
        attrs.merge!(recurrence: "weekly", day_of_week: at.wday, start_minute: at.hour * 60 + at.min, end_minute: [at.hour * 60 + at.min + 60, 1440].min)
      elsif at
        attrs.merge!(recurrence: "once", starts_at: at, ends_at: at + 1.hour)
      end
      sets = attrs.map { |k, v| "#{k} = #{v.nil? ? 'NULL' : quote(v.is_a?(Time) || v.is_a?(ActiveSupport::TimeWithZone) ? v.utc.iso8601 : v)}" }.join(", ")
      execute "UPDATE meetings SET #{sets} WHERE id = #{id}"
    end
  end

  def down; end

  private

  def quote(value) = connection.quote(value)
end
