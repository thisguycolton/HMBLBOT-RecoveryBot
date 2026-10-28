# A chip shared to the timeline is a note with the chip attached: which one (`chip_id`, as
# Chips.catalog names it) and how it looked when shared (`chip`), since a minted chip never
# changes. `chip_hidden` takes a sobriety chip off others' feeds while its owner no longer
# has it (their sobriety date changed), and brings it back if they have it again.
class AddChipToTimelineNotes < ActiveRecord::Migration[8.0]
  def change
    add_column :timeline_notes, :chip_id, :string
    add_column :timeline_notes, :chip, :jsonb
    add_column :timeline_notes, :chip_hidden, :boolean, default: false, null: false
    add_index :timeline_notes, [:user_id, :chip_id], where: "chip_id IS NOT NULL"
  end
end
