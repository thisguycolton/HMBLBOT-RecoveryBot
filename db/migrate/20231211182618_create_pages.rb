class CreatePages < ActiveRecord::Migration[7.0]
  def change
    create_table :pages do |t|
      t.references :book, null: false, foreign_key: true
      t.text :content
      t.string :page_number

      t.timestamps
    end
  end
end
