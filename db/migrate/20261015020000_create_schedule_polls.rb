class CreateSchedulePolls < ActiveRecord::Migration[8.0]
  def change
    create_table :schedule_polls do |t|
      t.references :user, null: false, foreign_key: true # the organizer who made it
      t.string :token, null: false, index: { unique: true }
      t.string :title, null: false
      t.text :description
      t.string :time_zone, null: false, default: "America/Phoenix"
      t.date :starts_on, null: false
      t.date :ends_on, null: false
      t.integer :duration_minutes, null: false, default: 60
      t.integer :choices_count, null: false, default: 3
      t.integer :slot_minutes, null: false, default: 30
      t.integer :day_start_minute, null: false, default: 480
      t.integer :day_end_minute, null: false, default: 1380
      t.string :results_visibility, null: false, default: "after_vote"
      t.jsonb :blocks, null: false, default: []
      t.datetime :closes_at, null: false
      t.datetime :closed_at
      t.timestamps
    end

    create_table :schedule_poll_members do |t|
      t.references :schedule_poll, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :role, null: false # collaborator | invitee
      t.timestamps
      t.index %i[schedule_poll_id user_id], unique: true
    end

    create_table :schedule_poll_ballots do |t|
      t.references :schedule_poll, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :voter_name
      t.string :voter_token, null: false
      t.string :ip_digest
      t.jsonb :choices, null: false, default: []
      t.timestamps
      t.index %i[schedule_poll_id voter_token], unique: true
      t.index %i[schedule_poll_id user_id], unique: true, where: "user_id IS NOT NULL"
      t.index %i[schedule_poll_id ip_digest]
    end
  end
end
