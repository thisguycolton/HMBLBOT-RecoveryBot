# Site Admin > Step worksheets (StepTemplate): the built-in worksheets move from
# config/step_tools/*.yml into the database, so they can be changed and published without a
# deploy. The YAML files are copied in once here as version 1 (here, not db:seed). Work members
# already started keeps its own copy, so nothing they have changes.
class CreateStepTemplates < ActiveRecord::Migration[8.0]
  def up
    create_table :step_templates do |t|
      t.string :key, null: false
      t.integer :step, null: false
      t.integer :steps, array: true, default: [], null: false
      t.string :name, null: false
      t.text :summary
      t.string :credit
      t.boolean :default, default: false, null: false
      t.boolean :hidden, default: false, null: false
      t.integer :position, default: 0, null: false
      t.jsonb :definition # the published version, what new worksheets start from
      t.jsonb :draft, default: {}, null: false
      t.integer :version, default: 0, null: false
      t.datetime :published_at
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :step_templates, :key, unique: true

    create_table :step_template_versions do |t|
      t.references :step_template, null: false, foreign_key: { on_delete: :cascade }
      t.integer :number, null: false
      t.string :name, null: false
      t.jsonb :definition, null: false
      t.references :published_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :created_at, null: false
    end
    add_index :step_template_versions, %i[step_template_id number], unique: true

    add_column :step_works, :tool_version, :integer

    now = Time.current
    Dir[Rails.root.join("config/step_tools/*.yml")].sort.each_with_index do |file, i|
      data = YAML.safe_load_file(file)
      definition = StepTool.clean(data.slice("intro", "sections", "credit", "layout"))
      id = connection.select_value(<<~SQL.squish)
        INSERT INTO step_templates (key, step, steps, name, summary, credit, "default", position, definition, draft, version, published_at, created_at, updated_at)
        VALUES (#{connection.quote(data['key'])}, #{data['step'].to_i}, #{connection.quote("{#{Array(data['steps'] || [data['step']]).map(&:to_i).join(',')}}")},
                #{connection.quote(data['name'])}, #{connection.quote(data['summary'])}, #{connection.quote(data['credit'])}, #{data['default'] ? 'TRUE' : 'FALSE'}, #{i},
                #{connection.quote(definition.to_json)}, #{connection.quote(definition.to_json)}, 1, #{connection.quote(now)}, #{connection.quote(now)}, #{connection.quote(now)})
        RETURNING id
      SQL
      connection.execute <<~SQL.squish
        INSERT INTO step_template_versions (step_template_id, number, name, definition, created_at)
        VALUES (#{id}, 1, #{connection.quote(data['name'])}, #{connection.quote(definition.to_json)}, #{connection.quote(now)})
      SQL
    end
  end

  def down
    remove_column :step_works, :tool_version
    drop_table :step_template_versions
    drop_table :step_templates
  end
end
