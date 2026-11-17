# When the "you got a chip" popup (ChipArrival) was shown for a given chip, so it only shows once.
# Chips already claimed count as shown, so nobody gets a pile of old ones.
class AddCelebratedAtToChipAwards < ActiveRecord::Migration[8.0]
  def up
    add_column :chip_awards, :celebrated_at, :datetime
    execute "UPDATE chip_awards SET celebrated_at = claimed_at WHERE claimed_at IS NOT NULL"
  end

  def down
    remove_column :chip_awards, :celebrated_at
  end
end
