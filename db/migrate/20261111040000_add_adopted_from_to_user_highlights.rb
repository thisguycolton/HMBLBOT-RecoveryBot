# A highlight someone adopted from another reader's shared highlight: which one (cleared if
# that one is deleted) and when, so it can still say "Adopted" after the original is gone.
class AddAdoptedFromToUserHighlights < ActiveRecord::Migration[8.0]
  def change
    add_reference :user_highlights, :adopted_from, null: true, index: true,
                  foreign_key: { to_table: :user_highlights, on_delete: :nullify }
    add_column :user_highlights, :adopted_at, :datetime
  end
end
