# A note written on someone else's profile (a person you follow or who follows you): its
# author is still `user_id`; `recipient_id` is whose page it's on (TimelineNote)
class AddRecipientToTimelineNotes < ActiveRecord::Migration[8.0]
  def change
    add_reference :timeline_notes, :recipient, foreign_key: { to_table: :users, on_delete: :cascade }, index: true
  end
end
