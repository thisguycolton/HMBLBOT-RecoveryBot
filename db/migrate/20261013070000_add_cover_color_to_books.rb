class AddCoverColorToBooks < ActiveRecord::Migration[8.0]
  def change
    add_column :books, :cover_color, :string
  end
end
