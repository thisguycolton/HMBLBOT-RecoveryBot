# The card a group chat message shows for its first link (LinkPreview, read in the background:
# ChatLinkPreviewJob). Its pictures and files are Active Storage attachments.
class AddLinkPreviewToChatMessages < ActiveRecord::Migration[8.0]
  def change
    add_column :chat_messages, :link_preview, :jsonb
  end
end
