# A deck of its own gets a share link (/h/CODE, like a meeting's date) and what people without an
# account may see through it. A hosting session notes when a live Topicificator window last
# asked for the topic (/topicificator?live=CODE), so the deck can say it's connected.
class AddSharingToDecksAndLiveTopicificator < ActiveRecord::Migration[8.0]
  def change
    add_column :decks, :share_code, :string
    add_column :decks, :guest_access, :string, null: false, default: "off"
    add_column :decks, :guest_script, :boolean, null: false, default: true
    add_index :decks, :share_code, unique: true
    add_column :hosting_sessions, :topicificator_seen_at, :datetime
  end
end
