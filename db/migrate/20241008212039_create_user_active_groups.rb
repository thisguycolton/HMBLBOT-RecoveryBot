class CreateUserActiveGroups < ActiveRecord::Migration[7.0]
  def change
    create_table :user_active_groups do |t|
      t.references :user, null: false, foreign_key: true
      t.references :group, null: false, foreign_key: true

      t.timestamps
    end
  end
end
