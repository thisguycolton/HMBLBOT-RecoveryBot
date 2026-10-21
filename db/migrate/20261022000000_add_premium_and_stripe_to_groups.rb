# Premium groups (Premium, Group#premium?) and 7th Tradition contributions through each group's own
# Stripe account. premium_until covers a paid year, the trial and a gifted year alike; plan
# "waived" is premium for good. Contributions keep totals only: no names, no emails.
class AddPremiumAndStripeToGroups < ActiveRecord::Migration[8.0]
  def change
    change_table :groups, bulk: true do |t|
      t.string :plan, default: "free", null: false
      t.datetime :premium_until
      t.string :stripe_customer_id
      t.string :stripe_subscription_id
      t.string :subscription_status
      t.string :stripe_account_id
      t.boolean :stripe_account_ready, default: false, null: false
      t.string :contribution_code
      t.text :contribution_note
    end
    add_index :groups, :stripe_customer_id, unique: true
    add_index :groups, :stripe_account_id, unique: true
    add_index :groups, :contribution_code, unique: true

    create_table :group_contributions do |t|
      t.references :group, null: false, foreign_key: true
      # The Checkout Session or Invoice it came from, so a webhook delivered twice counts once
      t.string :stripe_id, null: false
      t.integer :amount_cents, null: false
      t.boolean :recurring, default: false, null: false
      t.datetime :received_at, null: false
      t.timestamps
    end
    add_index :group_contributions, :stripe_id, unique: true
    add_index :group_contributions, %i[group_id received_at]
  end
end
