class AddCourtEmailToGroups < ActiveRecord::Migration[8.0]
  def change
    # The group's court verification email; blank means CourtLetter's default
    add_column :groups, :court_email_subject, :string
    add_column :groups, :court_email_body, :text
    # Gets a copy of each letter, and replies go to it
    add_column :groups, :court_email_reply_to, :string
  end
end
