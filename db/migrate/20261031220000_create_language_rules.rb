# The blocked-language list moves into the database so site admins can edit it
# (Content > Blocked words). Starts as config/blocked_language.yml.
class CreateLanguageRules < ActiveRecord::Migration[8.0]
  class Rule < ActiveRecord::Base
    self.table_name = "language_rules"
  end

  def up
    create_table :language_rules do |t|
      t.string :kind, null: false
      t.string :term, null: false
      t.string :note
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :language_rules, %i[kind term], unique: true

    now = Time.current
    starter = YAML.load_file(Rails.root.join("config/blocked_language.yml"))
    { "anywhere" => "anywhere", "words" => "word", "allowed" => "allowed" }.each do |key, kind|
      Array(starter[key]).map { |t| t.to_s.downcase.squish }.uniq.each do |term|
        Rule.create!(kind: kind, term: term, note: "Starter list", created_at: now, updated_at: now)
      end
    end
  end

  def down
    drop_table :language_rules
  end
end
