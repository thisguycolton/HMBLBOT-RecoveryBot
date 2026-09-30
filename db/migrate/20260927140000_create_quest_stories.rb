# "Tell our tale": fictional stories written from a journey's structured log. Only journey facts
# go in (encounters, topic titles, ways of sharing, stats) - nothing about people.
class CreateQuestStories < ActiveRecord::Migration[8.0]
  def change
    create_table :quest_stories do |t|
      t.references :quest_session, null: false, foreign_key: true
      t.string :style, null: false
      t.string :title
      t.text :body, null: false
      t.string :model
      t.timestamps
    end
  end
end
