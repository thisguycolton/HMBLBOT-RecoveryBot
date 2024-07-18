class CreatePolls < ActiveRecord::Migration[7.0]
  def change
    create_table :polls do |t|
      t.datetime :closeDate
      t.datetime :closeTime

      t.timestamps
    end
  end
end
