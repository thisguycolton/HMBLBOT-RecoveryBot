# Three more Steps 6 and 7 worksheets beside Drop the Rock: the Big Book's way (pages 75 and 76),
# the 12&12's way, and a short version. Copied from config/step_tools/*.yml as version 1, the
# same way CreateStepTemplates copied the first ones (here, not db:seed). A key that's already
# there is left alone, so this does nothing where CreateStepTemplates ran after the files were
# added, and nothing an admin changed is touched. Drop the Rock stays the default.
class AddAlternateStep67Worksheets < ActiveRecord::Migration[8.0]
  FILES = %w[step6_7_big_book step6_7_12_and_12 step6_7_short].freeze

  def up
    # With no templates at all, StepTool reads every file in config/step_tools (these included);
    # adding only these three would hide the rest
    return unless connection.select_value("SELECT 1 FROM step_templates LIMIT 1")

    now = Time.current
    FILES.each do |name|
      data = YAML.safe_load_file(Rails.root.join("config/step_tools/#{name}.yml"))
      next if connection.select_value("SELECT 1 FROM step_templates WHERE key = #{connection.quote(data['key'])}")

      definition = StepTool.clean(data.slice("intro", "sections", "credit", "layout"))
      position = connection.select_value("SELECT COALESCE(MAX(position), 0) + 1 FROM step_templates").to_i
      steps = "{#{Array(data['steps'] || [data['step']]).map(&:to_i).join(',')}}"
      id = connection.select_value(<<~SQL.squish)
        INSERT INTO step_templates (key, step, steps, name, summary, credit, "default", position, definition, draft, version, published_at, created_at, updated_at)
        VALUES (#{connection.quote(data['key'])}, #{data['step'].to_i}, #{connection.quote(steps)},
                #{connection.quote(data['name'])}, #{connection.quote(data['summary'])}, #{connection.quote(data['credit'])}, FALSE, #{position},
                #{connection.quote(definition.to_json)}, #{connection.quote(definition.to_json)}, 1, #{connection.quote(now)}, #{connection.quote(now)}, #{connection.quote(now)})
        RETURNING id
      SQL
      connection.execute <<~SQL.squish
        INSERT INTO step_template_versions (step_template_id, number, name, definition, created_at)
        VALUES (#{id}, 1, #{connection.quote(data['name'])}, #{connection.quote(definition.to_json)}, #{connection.quote(now)})
      SQL
    end
  end

  # Only removes them if nobody has started one, so no worksheet loses its template
  def down
    keys = FILES.map { |name| YAML.safe_load_file(Rails.root.join("config/step_tools/#{name}.yml"))["key"] }
    keys.each do |key|
      next if connection.select_value("SELECT 1 FROM step_works WHERE tool_key = #{connection.quote(key)}")

      connection.execute("DELETE FROM step_templates WHERE key = #{connection.quote(key)}")
    end
  end
end
