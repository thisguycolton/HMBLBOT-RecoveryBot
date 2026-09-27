# Journey statistics and the journey summary for ACID QUEST, computed from the log.
#
# These describe the journey, never anyone's performance: nothing is ranked, and passes are
# deliberately never counted or reported. The summary shape is also what a post-meeting
# story generator would read, so it holds only structured facts (no names, no free text).
class JourneyStats
  MILES_PER_TILE = 0.1
  # Courage / Connection / Hope. Keep in step with app/javascript/quest/resources.js.
  COURAGE_APPROACHES = %w[risky chaos].freeze
  COURAGE_ENCOUNTERS = %w[ghost mystery].freeze
  CONNECTION_MODES = %w[connection].freeze
  CONNECTION_ENCOUNTERS = %w[campfire house].freeze
  HOPE_MODES = %w[looking_forward gratitude change].freeze

  def initialize(quest_session)
    @session = quest_session
    @entries = quest_session.quest_log_entries.includes(:topic).order(:id).to_a
  end

  def stats
    shares = of_kind("share")
    {
      miles_traveled: (of_kind("move").sum { |e| e.data["tiles"].to_i } * MILES_PER_TILE).round(1),
      stories_shared: shares.size,
      topics_explored: shares.map(&:topic_id).compact.uniq.size,
      connections_made: shares.count { |e| CONNECTION_MODES.include?(e.sharing_mode_key) || CONNECTION_ENCOUNTERS.include?(e.encounter) },
      courage_found: shares.count { |e| COURAGE_APPROACHES.include?(e.approach) || COURAGE_ENCOUNTERS.include?(e.encounter) },
      hope_found: shares.count { |e| HOPE_MODES.include?(e.sharing_mode_key) || e.approach == "revisit" },
      encounters: of_kind("encounter").size,
      gates_opened: of_kind("gate").count { |e| e.data["opened"] },
    }
  end

  def summary
    shares = of_kind("share")
    topic_counts = shares.filter_map(&:topic).group_by(&:id)
    {
      journey: {
        name: @session.name,
        topic_set: @session.topic_set&.name,
        started_at: @session.created_at,
        completed_at: @session.completed_at,
      },
      encounters: of_kind("encounter").map(&:encounter),
      topics_shared: topic_counts.values.map { |ts| title(ts.first) },
      topics_revisited: topic_counts.values.select { |ts| ts.size > 1 }.map { |ts| title(ts.first) },
      sharing_modes: shares.map(&:sharing_mode_key).compact.uniq,
      topics: topic_counts.values.map do |ts|
        { title: title(ts.first), modes: shares.select { |e| e.topic_id == ts.first.id }.map(&:sharing_mode_key).compact.uniq }
      end,
      stats: stats,
    }
  end

  # The journey, step by step, for the log viewer. Structured facts only; passes (and the
  # bookkeeping kinds: draws, forks) are left out, so nobody's "no" is ever on the record.
  TIMELINE_KINDS = %w[move encounter share item obstacle help gate].freeze

  def timeline
    @entries.select { |e| TIMELINE_KINDS.include?(e.kind) }.map do |e|
      {
        kind: e.kind,
        encounter: e.encounter,
        topic: e.topic && title(e.topic),
        sharing_mode: e.sharing_mode_key,
        approach: e.approach,
        data: e.data.slice("tiles", "cannon", "item", "uses", "legendary", "obstacle", "mode", "opened"),
        at: e.created_at,
      }
    end
  end

  private

  def of_kind(kind)
    @entries.select { |e| e.kind == kind }
  end

  def title(topic)
    [topic.title, topic.subtitle].compact_blank.join(" ")
  end
end
