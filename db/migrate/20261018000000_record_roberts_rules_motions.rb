# The group runs its meetings by Robert's Rules and votes in the room; the app only records it.
# So a motion has a kind (main, amend, table, refer...), the motion it applies to, how it was
# voted, and what the rules required; a meeting has its times and a quorum; and what was
# tabled, postponed or referred can come back as unfinished business.
class RecordRobertsRulesMotions < ActiveRecord::Migration[8.0]
  def change
    add_column :motions, :kind, :string, null: false, default: "main"
    add_reference :motions, :parent, foreign_key: { to_table: :motions, on_delete: :nullify }
    add_column :motions, :vote_method, :string
    # nil: what the rules ask for this kind of motion; set when the bylaws ask for more or less
    add_column :motions, :required_vote, :string
    add_column :motions, :previous_notice, :boolean, null: false, default: false
    add_column :motions, :committee, :string
    add_column :motions, :postponed_to, :string
    add_column :motions, :amended_text, :text
    add_column :motions, :note, :text

    add_reference :agenda_items, :motion, foreign_key: { on_delete: :nullify }

    add_column :business_meetings, :called_to_order_at, :datetime
    add_column :business_meetings, :adjourned_at, :datetime

    # Bylaws give a quorum as a number of members or a share of them
    add_column :groups, :quorum_count, :integer
    add_column :groups, :quorum_percent, :integer
  end
end
