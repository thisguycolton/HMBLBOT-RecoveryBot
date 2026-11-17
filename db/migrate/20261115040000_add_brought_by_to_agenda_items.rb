# Who brought an agenda item to the group, when a record keeper types it in for them (a
# suggestion made in person or by text). Blank means whoever submitted it in the app.
class AddBroughtByToAgendaItems < ActiveRecord::Migration[8.0]
  def change
    add_column :agenda_items, :brought_by, :string
  end
end
