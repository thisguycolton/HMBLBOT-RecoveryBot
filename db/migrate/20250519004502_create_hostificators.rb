class CreateHostificators < ActiveRecord::Migration[8.0]
  def change
    create_table :hostificators do |t|
      t.datetime :meeting_date_time
      t.time :poll_closes_at

      t.timestamps
    end
  end
end
