# A sponsor and a sponsee on the site (Sponsorship), what the sponsee sends their sponsor
# (SponsorshipShare), and each sponsor's invite link (users.sponsor_invite_token)
class CreateSponsorships < ActiveRecord::Migration[8.0]
  def change
    create_table :sponsorships do |t|
      t.references :sponsor, null: false, foreign_key: { to_table: :users, on_delete: :cascade }
      t.references :sponsee, null: false, foreign_key: { to_table: :users, on_delete: :cascade }
      t.string :status, null: false, default: "pending"
      t.text :note
      t.date :started_on
      t.datetime :ended_at
      t.references :ended_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :sponsorships, %i[sponsor_id sponsee_id], unique: true, where: "status IN ('pending', 'active')",
                                                         name: "index_sponsorships_open_pair"

    create_table :sponsorship_shares do |t|
      t.references :sponsorship, null: false, foreign_key: { on_delete: :cascade }
      t.string :kind, null: false
      t.date :on, null: false
      t.string :title, null: false
      t.text :body, null: false
      t.datetime :seen_at
      t.text :reply
      t.datetime :replied_at
      t.timestamps
    end
    add_index :sponsorship_shares, %i[sponsorship_id created_at]

    add_column :users, :sponsor_invite_token, :string
    add_index :users, :sponsor_invite_token, unique: true
  end
end
