# Site Admin > HostDeck scripts: meeting scripts every group can start from (HostScriptTemplate).
# Adds the built-in one, modeled on The Acid Test's host format, unless it's already there, so
# this is safe to run on any database (no db:seed needed).
class CreateHostScriptTemplates < ActiveRecord::Migration[8.0]
  class Template < ActiveRecord::Base
    self.table_name = "host_script_templates"
  end

  def up
    create_table :host_script_templates do |t|
      t.string :key
      t.string :name, null: false
      t.string :description
      t.text :body
      t.boolean :hidden, default: false, null: false
      t.integer :position, default: 0, null: false
      t.references :updated_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :host_script_templates, :key, unique: true, where: "key IS NOT NULL"

    Template.reset_column_information
    return if Template.exists?(key: "online_meeting")

    Template.create!(key: "online_meeting", name: "Online meeting host format", position: 1,
                     description: "Welcome, readings, newcomers and milestones, the day's activity, sharing and closing. Modeled on The Acid Test's host format.",
                     body: DocumentHtml.sanitize(File.read(Rails.root.join("app/models/host_script_template/online_meeting.html"))))
  end

  def down
    drop_table :host_script_templates
  end
end
