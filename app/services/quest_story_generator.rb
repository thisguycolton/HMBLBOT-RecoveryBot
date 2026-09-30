# "Tell our tale": a short, clearly fictional story of an ACID QUEST journey, written by a
# language model from the journey's structured log alone (JourneyStats). The log holds no names,
# no free text and nothing anyone said - so the story can't reveal any of it - and the
# instructions keep the tale about the road, never about the people who shared.
class QuestStoryGenerator
  STYLES = {
    "fantasy" => { name: "Fantasy quest", voice: "a warm high-fantasy quest tale, like an old storybook" },
    "adventure" => { name: "Classic adventure", voice: "a brisk classic adventure serial, full of maps, weather and narrow escapes" },
    "western" => { name: "Old Western", voice: "a dusty, good-humoured frontier Western told around a campfire" },
    "space" => { name: "Space adventure", voice: "a hopeful space-opera voyage between strange planets" },
    "ridiculous" => { name: "Completely ridiculous", voice: "a gleefully absurd comic tale - silly, kind, never mean" },
  }.freeze

  MAX_PER_JOURNEY = 5
  # The quest API has no login, so cap tales per day overall to protect a free AI quota
  def self.daily_limit = (ENV["QUEST_AI_DAILY_TALES"].presence || 100).to_i

  SCHEMA = {
    type: "object",
    properties: {
      title: { type: "string", description: "A short title for the tale" },
      story: { type: "string", description: "The tale itself, 250-450 words, in paragraphs separated by blank lines" },
    },
    required: %w[title story],
    additionalProperties: false,
  }.freeze

  SYSTEM = <<~PROMPT.freeze
    You write short, clearly fictional tales about a journey a recovery group took together in
    ACID QUEST, a 16-bit adventure game played during a 12-step style meeting. One person steered;
    the whole room travelled as one party. At each stop the room discussed a topic in its own way.

    You receive only facts about the road: places reached, encounters, topic titles, the ways of
    sharing chosen, things found, gates opened, and a few totals. Turn them into a story.

    Rules - these matter more than style:
    - The travellers are always "the party", "the travellers" or "the company" as a whole. Never
      name, number, describe or single out any member - no leader, no guide, no "one of them",
      no "someone" - and never give a traveller their own line of dialogue or action. The party
      may speak or act only together, as one. Characters met on the road (a merchant, a ghost,
      a villager) may speak.
    - Topic titles are landmarks and themes of the road. Never invent or hint at what anyone
      shared, confessed, felt or experienced (not even vaguely, like "each told their story"),
      and never tell drinking or using stories. Don't describe or count the shares themselves
      ("heavy", "light", "four shares passed"): the road and its landmarks are the story.
    - No diagnosing, moralizing, preaching or program advice. Don't glamorize alcohol or drugs.
      No relapse or peril aimed at the travellers' recovery.
    - Keep it warm, hopeful and a little funny - but the humour belongs to the road, the weather
      and the characters met, never to the topics themselves. Treat every topic with respect.
    - Topics are landmarks: weave in the 6-10 that make the best story (all of them if there are
      fewer), naturally, as places or signposts. Don't list them.
    - Write 250-450 words in the requested style. Plain prose, no headings, no lists.
    - Return JSON with "title" and "story".
  PROMPT

  class LimitReached < StandardError; end

  def initialize(quest_session, client: nil)
    @session = quest_session
    @client = client
  end

  def self.enabled?
    LlmClient.configured?(:story)
  end

  def generate(style)
    raise ArgumentError, "Unknown style" unless STYLES.key?(style)
    raise LimitReached, "This journey already has #{MAX_PER_JOURNEY} tales." if @session.quest_stories.count >= MAX_PER_JOURNEY
    if QuestStory.where(created_at: Time.current.all_day).count >= self.class.daily_limit
      raise LimitReached, "The storyteller has told all the tales it can today. Try again tomorrow."
    end

    client = @client || LlmClient.new(purpose: :story)
    reply = client.chat(
      system: SYSTEM,
      user: "Style: #{STYLES[style][:voice]}.\n\nThe road:\n#{facts}",
      schema: SCHEMA,
      schema_name: "tale",
      max_tokens: 12_000,
      effort: "low",
      # a few free models answer with a sketch; that's not a tale
      accept: ->(r) { r["story"].to_s.split.size >= 150 },
    )
    title, body = reply["title"].to_s.strip, paragraphs(reply["story"].to_s.strip)
    raise LlmClient::BadResponse, "The tale came back empty" if body.empty?
    @session.quest_stories.create!(style: style, title: title.presence, body: body, model: client.last_endpoint&.label)
  end

  # The journey as plain facts, in order. Built from JourneyStats (structured log only).
  def facts
    stats = JourneyStats.new(@session)
    summary = stats.summary
    s = summary[:stats]
    lines = []
    lines << "Topic set: #{summary.dig(:journey, :topic_set)}" if summary.dig(:journey, :topic_set)
    lines << "Totals: #{s[:miles_traveled]} miles, #{s[:encounters]} stops, " \
             "Courage #{s[:courage_found]}, Connection #{s[:connections_made]}, Hope #{s[:hope_found]}"
    lines << "Along the way:"
    shared = []
    stats.timeline.each do |e|
      line = describe(e) or next
      next if e[:kind] == "share" && shared.include?(line) # the same topic, shared again
      shared << line if e[:kind] == "share"
      lines << "- #{line}"
    end
    lines.join("\n")
  end

  private

  # Some models separate paragraphs with double spaces instead of blank lines
  def paragraphs(text)
    return text if text.include?("\n\n")
    text.gsub(/(?<=[.!?'"”’])\s{2,}(?=\S)/, "\n\n").gsub(/(?<!\n)\n(?!\n)/, "\n\n")
  end

  ENCOUNTER_NAMES = {
    "mystery" => "a mysterious shimmering stop", "merchant" => "a wandering merchant's cart", "campfire" => "a campfire",
    "ghost" => "a ghost by the road", "cannon" => "an old cannon", "memory" => "a humming Memory Stone",
    "house" => "a village house", "well" => "a village well", "castle" => "a castle",
  }.freeze
  OBSTACLES = { "ford" => "a river (by boat)", "boulder" => "a boulder (with a pickaxe)", "log" => "a fallen tree (with an axe)", "climb" => "a cliff (by rope)" }.freeze
  APPROACHES = { "risky" => " (taking a risk)", "chaos" => " (leaving it to chance)", "revisit" => " (returning to it)" }.freeze

  def describe(e)
    case e[:kind]
    when "move" then e.dig(:data, "cannon") ? "flew by cannon" : nil
    when "encounter" then (name = ENCOUNTER_NAMES[e[:encounter]]) && "came to #{name}"
    # ways of sharing are left out on purpose: they add little, and pairing "Funny Story" with a
    # heavy topic invited jokes about the topic
    when "share" then e[:headline] ? "talked about \"#{e[:headline].delete('"')}\"#{APPROACHES[e[:approach]]}" : "checked in together"
    when "item"
      item = "#{e.dig(:data, 'legendary') ? 'legendary ' : ''}#{e.dig(:data, 'item')}"
      "received #{item.match?(/\A[aeiou]/i) ? 'an' : 'a'} #{item}"
    when "obstacle" then (o = OBSTACLES[e.dig(:data, "obstacle")]) && "crossed #{o}"
    when "help" then e.dig(:data, "mode") == "friend" ? "a friend came to help" : "a merchant helped them on"
    when "gate" then e.dig(:data, "opened") ? "voted to open a locked gate" : nil
    end
  end
end
