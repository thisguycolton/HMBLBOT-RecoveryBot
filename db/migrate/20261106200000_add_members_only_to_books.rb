# A book only members of a group that lists it in its literature can read (Book#readable_by?)
class AddMembersOnlyToBooks < ActiveRecord::Migration[8.0]
  def change
    add_column :books, :members_only, :boolean, default: false, null: false
  end
end
