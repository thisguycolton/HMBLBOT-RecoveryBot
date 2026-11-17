# Someone following an AA Intergroup group that isn't on RecoveryBot yet, to hear when it is
class CreateIntergroupFollows < ActiveRecord::Migration[8.0]
  def change
    create_table :intergroup_follows do |t|
      t.references :user, null: false, foreign_key: true
      t.string :group_name, null: false
      t.string :oiaa_slug, null: false
      t.datetime :notified_at
      t.timestamps
    end
    add_index :intergroup_follows, %i[user_id group_name], unique: true
    add_index :intergroup_follows, :group_name
  end
end
