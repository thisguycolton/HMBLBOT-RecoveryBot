class CreateBooks < ActiveRecord::Migration[7.0]
  def change
    create_table :books do |t|
      t.string :title
      t.string :author
      t.string :info
      t.string :pdf_url
      t.date :published_date
      t.string :purchase_link

      t.timestamps
    end
  end
end
