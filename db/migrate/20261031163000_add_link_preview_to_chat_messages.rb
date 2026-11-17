# The card a group chat message shows for its first link (LinkPreview, read in the background:
# ChatLinkPreviewJob), and the group documents attached to it. Its pictures and files are
# Active Storage attachments.
class AddLinkPreviewToChatMessages < ActiveRecord::Migration[8.0]
  def change
    change_table :chat_messages, bulk: true do |t|
      t.jsonb :link_preview
      t.bigint :document_ids, array: true, default: [], null: false
    end
  end
end
