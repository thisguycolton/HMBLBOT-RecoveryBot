# Shares on readings, part two: one level of replies (`parent_id`; replies go with their share),
# muting someone's shares without seeing who they are (share_mutes), and a site admin stopping
# someone from sharing for a while (users.shares_suspended_until), from a report, even an
# anonymous one, without learning who wrote it.
class AddRepliesMutesAndSuspensionsToReadingShares < ActiveRecord::Migration[8.0]
  def change
    add_reference :reading_shares, :parent, foreign_key: { to_table: :reading_shares, on_delete: :cascade }

    create_table :share_mutes do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.references :muted_user, null: false, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :share_mutes, %i[user_id muted_user_id], unique: true

    add_column :users, :shares_suspended_until, :datetime
  end
end
