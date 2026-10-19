# Sign-up moves from admin approval to email confirmation (Devise :confirmable). Everyone an
# admin already approved counts as confirmed; people still waiting confirm their email.
class ConfirmApprovedUsers < ActiveRecord::Migration[8.0]
  def up
    execute "UPDATE users SET confirmed_at = COALESCE(updated_at, created_at) WHERE confirmed = TRUE AND confirmed_at IS NULL"
  end

  def down; end
end
