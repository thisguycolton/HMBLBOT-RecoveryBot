class CreateCourtVerifications < ActiveRecord::Migration[7.1]
  def change
    create_table :court_verifications do |t|
      t.string   :respondent_name,  null: false
      t.string   :respondent_email, null: false
      t.datetime :meeting_at,       null: false
      t.string   :host_name,        null: false
      t.string   :signer_name,      null: false
      t.string   :topic,            null: false


      t.timestamps
    end

    add_index :court_verifications, :respondent_email
    add_index :court_verifications, :meeting_at
  end
end
