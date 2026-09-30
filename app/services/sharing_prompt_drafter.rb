# Drafts per-topic wording for the ACID QUEST ways of sharing with a language model (see
# LlmClient). Everything it writes is a draft (source: "ai") for a person to approve in the
# Topicificator admin; the game only ever uses approved wording. It never touches a topic/way
# of sharing that already has a row, human or AI.
class SharingPromptDrafter
  SYSTEM = <<~PROMPT.freeze
    You write sharing prompts for ACID QUEST, a game played during 12-step style recovery
    meetings. The room is shown a topic, then picks a "way of sharing" it; each way has a
    generic prompt that refers to the topic as "this". Rewrite each generic prompt so it speaks
    about this particular topic, keeping the way of sharing's intent.

    Each prompt:
    - is one short invitation to the room, 8-25 words, usually a question, in plain warm words
      and second person ("you");
    - is specific to the topic, but never assumes anything about anyone's history (relapse,
      trauma, family, faith, jobs) and never requires disclosing details;
    - gives no advice, no diagnosis, no program doctrine; for spiritual topics, keep "as you
      understand it" open-mindedness;
    - stays low-pressure for gentle ways of sharing (Check-In, Connection, Funny Story, Gratitude);
    - Funny Story invites a light moment, never mockery of anyone's struggle.

    Return JSON: {"prompts": [{"mode": "<way of sharing key>", "text": "<prompt>"}]}, one entry
    for every way of sharing you were given, in any order.
  PROMPT

  Result = Struct.new(:created, :skipped, keyword_init: true)

  def initialize(client: nil, logger: $stdout)
    @client = client
    @logger = logger
  end

  # The ways of sharing this topic still has no row for
  def missing_modes(topic, modes)
    have = topic.topic_sharing_prompts.map(&:sharing_mode_id)
    modes.reject { |m| have.include?(m.id) }
  end

  def draft(topic, modes)
    modes = missing_modes(topic, modes)
    return Result.new(created: 0, skipped: 0) if modes.empty?

    client = (@client ||= LlmClient.new(purpose: :draft))
    reply = client.chat(
      system: SYSTEM,
      user: request_for(topic, modes),
      schema: schema(modes),
      schema_name: "sharing_prompts",
      max_tokens: 10_000,
      effort: "low",
    )
    by_key = modes.index_by(&:key)
    created = skipped = 0
    Array(reply["prompts"]).each do |entry|
      mode = by_key.delete(entry["mode"].to_s)
      text = entry["text"].to_s.squish
      if mode.nil? || !usable?(text)
        skipped += 1
        next
      end
      topic.topic_sharing_prompts.create!(sharing_mode: mode, text: text, status: "draft", source: "ai", enabled: true)
      created += 1
    end
    Result.new(created: created, skipped: skipped + by_key.size)
  end

  def request_for(topic, modes)
    lines = ["Topic: #{[topic.title, topic.subtitle].compact_blank.join(' ').squish}"]
    lines << "Category: #{topic.topic_category.title}" if topic.topic_category
    lines << "Ways of sharing:"
    modes.each { |m| lines << "- #{m.key} (#{m.name}#{m.gentle ? ', gentle' : ''}): #{m.prompt}" }
    lines.join("\n")
  end

  private

  def schema(modes)
    {
      type: "object",
      properties: {
        prompts: {
          type: "array",
          items: {
            type: "object",
            properties: { mode: { type: "string", enum: modes.map(&:key) }, text: { type: "string" } },
            required: %w[mode text],
            additionalProperties: false,
          },
        },
      },
      required: %w[prompts],
      additionalProperties: false,
    }
  end

  # Cheap sanity checks; a person reviews everything anyway
  def usable?(text)
    words = text.split.size
    words.between?(4, 40) && !text.match?(/\bthis\b.*\bthis\b.*\bthis\b/i)
  end
end
