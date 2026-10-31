# Meeting Maker chips are now one series for each meeting name in a group (a daily meeting is
# often one record a day), under the lowest-id meeting with that name. Nothing about the chips
# themselves is stored, so this only moves members' favorites and picked tops that point at a
# chip under another of those meetings' ids ("meeting-12:1" -> "meeting-10:1").
class MergeMeetingMakerSeries < ActiveRecord::Migration[8.0]
  class Meeting < ActiveRecord::Base
    self.table_name = "meetings"
  end

  class User < ActiveRecord::Base
    self.table_name = "users"
  end

  def up
    mains = {}
    main_of = {}
    Meeting.order(:id).pluck(:id, :group_id, :name).each do |id, group_id, name|
      key = name.to_s.squish.downcase.presence
      main_of[id] = key ? (mains[[group_id, key]] ||= id) : id
    end
    move = ->(chip_id) { chip_id.to_s.sub(/\Ameeting-(\d+):/) { "meeting-#{main_of[$1.to_i] || $1}:" } }

    User.where("chip_favorites::text LIKE '%meeting-%' OR chip_tops::text LIKE '%meeting-%'").find_each do |user|
      favorites = user.chip_favorites.map(&move).uniq
      tops = user.chip_tops.to_h { |slot, id| [move.call(slot), move.call(id)] }
      user.update_columns(chip_favorites: favorites, chip_tops: tops) if favorites != user.chip_favorites || tops != user.chip_tops
    end
  end

  def down; end
end
