# A sponsor nudging a sponsee about their step work (sponsorships.nudged_at, nudge_note), and
# a worksheet's own password-protected link (step_works.share_token, share_password_digest)
class AddNudgesAndWorksheetLinks < ActiveRecord::Migration[8.0]
  def change
    add_column :sponsorships, :nudged_at, :datetime
    add_column :sponsorships, :nudge_note, :string

    add_column :step_works, :share_token, :string
    add_column :step_works, :share_password_digest, :string
    add_column :step_works, :shared_at, :datetime
    add_column :step_works, :share_viewed_at, :datetime
    add_index :step_works, :share_token, unique: true
  end
end
