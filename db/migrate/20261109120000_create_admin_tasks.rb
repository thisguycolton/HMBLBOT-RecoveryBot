# Site Admin > Task board (codename SCRUMBLBOT): things the site admins need to do, as cards
# in columns. A task can be grabbed by any site admin, given to one, or given to all of them.
# One board for the whole site, so there's no boards table: its columns are rows here, and the
# three it starts with are made below.
class CreateAdminTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :admin_task_columns do |t|
      t.string :name, null: false
      t.string :kind, null: false, default: "doing" # start, doing, finished
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    create_table :admin_tasks do |t|
      t.references :admin_task_column, null: false, foreign_key: true
      t.integer :position, null: false, default: 0
      t.string :title, null: false
      t.text :notes
      t.jsonb :checklist, null: false, default: []
      t.string :priority, null: false, default: "normal" # normal, high
      t.date :due_on
      t.string :link_path
      t.references :creator, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :assignee, foreign_key: { to_table: :users, on_delete: :nullify }
      t.boolean :for_all_admins, null: false, default: false
      t.datetime :completed_at
      t.references :completed_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :archived_at
      t.date :due_reminded_on
      t.date :overdue_reminded_on
      t.timestamps
    end
    add_index :admin_tasks, %i[admin_task_column_id position]
    add_index :admin_tasks, :due_on, where: "completed_at IS NULL"

    create_table :admin_task_activities do |t|
      t.references :admin_task, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, foreign_key: { on_delete: :nullify }
      t.string :kind, null: false # comment, created, took, let_go, gave, moved, done, reopened, edited
      t.text :body
      t.jsonb :data, null: false, default: {}
      t.timestamps
    end

    reversible do |dir|
      dir.up do
        execute <<~SQL
          INSERT INTO admin_task_columns (name, kind, position, created_at, updated_at) VALUES
            ('Up for grabs', 'start', 1, NOW(), NOW()),
            ('Doing', 'doing', 2, NOW(), NOW()),
            ('Done', 'finished', 3, NOW(), NOW())
        SQL
      end
    end
  end
end
