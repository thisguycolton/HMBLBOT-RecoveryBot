# A reading started from someone else's ("Adopt" while typing a title): which one it came from
class AddAdoptedFromToReadings < ActiveRecord::Migration[8.0]
  def change
    add_reference :readings, :adopted_from, foreign_key: { to_table: :readings, on_delete: :nullify }, index: true, null: true
  end
end
