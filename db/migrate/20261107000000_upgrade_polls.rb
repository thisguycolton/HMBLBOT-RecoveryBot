# Polls become real polls (app/models/poll.rb): a question, typed answers, who can vote, a short
# link, and a ballot per voter (who voted for what). The old topic polls keep their answers.
class UpgradePolls < ActiveRecord::Migration[8.0]
  def up
    change_table :polls, bulk: true do |t|
      t.string :token
      t.string :question
      t.text :details
      t.references :user, foreign_key: true
      t.references :group, foreign_key: true
      t.integer :max_choices, null: false, default: 1
      t.string :audience, null: false, default: "signed_in"
      t.string :results_visibility, null: false, default: "always"
      t.string :voters_visibility, null: false, default: "managers"
      t.datetime :closes_at
      t.datetime :closed_at
      # What it's attached to: a Reading, a Motion
      t.references :subject, polymorphic: true
    end

    change_table :options, bulk: true do |t|
      t.string :label
      t.integer :position, null: false, default: 0
    end

    create_table :poll_ballots do |t|
      t.references :poll, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :voter_token, null: false
      t.string :voter_name
      t.string :ip_digest
      t.bigint :option_ids, array: true, null: false, default: []
      t.timestamps
    end
    add_index :poll_ballots, %i[poll_id user_id], unique: true, where: "user_id IS NOT NULL"
    add_index :poll_ballots, %i[poll_id voter_token], unique: true

    # The old topic polls: a code, a question, their close date, and each answer's topic title
    execute <<~SQL
      UPDATE options SET label = COALESCE(topics.title, NULLIF(options.topic_title, ''), 'Answer')
      FROM options o LEFT JOIN topics ON topics.id = o.topic_id WHERE o.id = options.id;
      UPDATE options SET position = sub.n FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY poll_id ORDER BY id) - 1 AS n FROM options) sub
      WHERE sub.id = options.id;
      UPDATE polls SET question = 'Which topic should we read?', closes_at = "closeDate",
        token = substr(md5(random()::text || id::text), 1, 8);
    SQL
    # Their old rich text description, kept as plain text
    say_with_time "copying old poll descriptions" do
      ActionText::RichText.where(record_type: "Poll", name: "description").find_each do |rt|
        text = rt.body&.to_plain_text.to_s.strip
        execute("UPDATE polls SET details = #{connection.quote(text)} WHERE id = #{rt.record_id.to_i}") if text.present?
      end
    end

    add_index :polls, :token, unique: true
  end

  def down
    remove_index :polls, :token
    drop_table :poll_ballots
    remove_columns :options, :label, :position
    remove_reference :polls, :subject, polymorphic: true
    remove_reference :polls, :user, foreign_key: true
    remove_reference :polls, :group, foreign_key: true
    remove_columns :polls, :token, :question, :details, :max_choices, :audience, :results_visibility,
                   :voters_visibility, :closes_at, :closed_at
  end
end
