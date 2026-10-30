# Group chat (GroupChat): a group's channels, the messages in them, and how far each member has
# read in each. Admins pick who else may add channels (chat_creator_roles, chat_creator_user_ids).
class CreateGroupChat < ActiveRecord::Migration[8.0]
  def change
    create_table :chat_channels do |t|
      t.references :group, null: false, foreign_key: true
      t.string :name, null: false
      t.string :topic, null: false, default: ""
      # Who's in it besides the group's admins: "members" for everyone, or roles (ChatChannel::ROLES)
      t.string :access_roles, array: true, null: false, default: ["members"]
      t.bigint :access_user_ids, array: true, null: false, default: []
      t.boolean :archived, null: false, default: false
      t.integer :position, null: false, default: 0
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :last_message_at
      t.timestamps
    end
    add_index :chat_channels, "group_id, lower(name)", unique: true, name: "index_chat_channels_on_group_and_name"

    create_table :chat_messages do |t|
      t.references :chat_channel, null: false, foreign_key: true, index: false
      t.references :user, null: false, foreign_key: true
      t.text :body, null: false
      t.datetime :edited_at
      # The @ mentions in it as they were resolved (Mentions), and who has been told
      t.jsonb :mentions, null: false, default: {}
      t.bigint :mentioned_user_ids, array: true, null: false, default: []
      t.timestamps
    end
    add_index :chat_messages, %i[chat_channel_id id]

    create_table :chat_reads do |t|
      t.references :chat_channel, null: false, foreign_key: true, index: false
      t.references :user, null: false, foreign_key: true
      t.bigint :last_read_message_id, null: false, default: 0
      t.timestamps
    end
    add_index :chat_reads, %i[chat_channel_id user_id], unique: true

    change_table :groups, bulk: true do |t|
      t.string :chat_creator_roles, array: true, null: false, default: []
      t.bigint :chat_creator_user_ids, array: true, null: false, default: []
    end
  end
end
