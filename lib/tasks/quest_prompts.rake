# Drafts per-topic wording for ACID QUEST's ways of sharing (SharingPromptDrafter). Drafts land
# in the Topicificator admin ("Has drafts to review"); nothing reaches the game until approved.
#
#   bin/rails quest:draft_prompts                 # 25 topics that still need wording
#   bin/rails quest:draft_prompts SET=2 LIMIT=100 # only topic set 2
#   bin/rails quest:draft_prompts TOPIC_IDS=1,5 MODES=story,gratitude
#   bin/rails quest:draft_prompts DRY_RUN=1       # show what would be asked, call nothing
#
# DELAY (seconds between requests, default 5) keeps a free Gemini key under its per-minute limit.
# Each topic is one request, sent down the drafting chain (LlmClient: QUEST_AI_DRAFT_CHAIN, or
# CHAIN= for this run, e.g. CHAIN=ollama:qwen3.8:27b). Free tiers allow roughly 20 (Gemini, per
# model) + 50 (OpenRouter) requests a day, so drafting all topics takes several days of runs.
# Safe to re-run: it skips anything that already has a row, and stops cleanly when rate-limited.
namespace :quest do
  desc "Draft per-topic sharing prompts with the configured AI model (drafts for review)"
  task draft_prompts: :environment do
    modes = SharingMode.active.to_a
    modes = modes.select { |m| ENV["MODES"].split(",").map(&:strip).include?(m.key) } if ENV["MODES"].present?
    abort "No matching sharing modes" if modes.empty?

    scope = Topic.includes(:topic_category, :topic_sharing_prompts).order(:topic_set_id, :id)
    scope = scope.where(topic_set_id: ENV["SET"]) if ENV["SET"].present?
    scope = scope.where(id: ENV["TOPIC_IDS"].split(",").map(&:to_i)) if ENV["TOPIC_IDS"].present?
    limit = (ENV["LIMIT"].presence || 25).to_i
    chain = LlmClient.chain(:draft, ENV["CHAIN"].presence)
    delay = (ENV["DELAY"].presence || (chain.all? { |e| e.provider == "ollama" } ? 0 : 5)).to_f

    drafter = SharingPromptDrafter.new(client: chain.any? ? LlmClient.new(endpoints: chain) : nil)
    todo = scope.to_a.reject { |t| drafter.missing_modes(t, modes).empty? }.first(limit)
    puts "#{todo.size} topic(s) to draft (#{modes.size} way(s) of sharing each at most)."
    abort "Nothing to do." if todo.empty?

    if ENV["DRY_RUN"].present?
      puts "", SharingPromptDrafter::SYSTEM, "--- first request ---", drafter.request_for(todo.first, drafter.missing_modes(todo.first, modes))
      next
    end
    abort "No AI configured: set GEMINI_API_KEY and/or OPENROUTER_API_KEY, or CHAIN=ollama:<model>." if chain.empty?
    puts "Drafting with: #{chain.map(&:label).join(' -> ')}"

    created = skipped = done = 0
    todo.each_with_index do |topic, i|
      begin
        result = drafter.draft(topic, modes)
      rescue LlmClient::RateLimited => e
        puts e.daily ? "Today's free quota is used up after #{done} topic(s). Run again tomorrow (or with CHAIN=ollama:<model>)." :
                       "Rate limited after #{done} topic(s). Run the task again in a minute to continue."
        break
      rescue LlmClient::Error => e
        puts "  ! #{topic.id} #{topic.title}: #{e.message}"
        next
      end
      created += result.created
      skipped += result.skipped
      done += 1
      puts format("  %4d/%d  #%-5d %-50s +%d%s", i + 1, todo.size, topic.id, topic.title.to_s[0, 50], result.created,
                  result.skipped.positive? ? " (#{result.skipped} unusable)" : "")
      sleep(delay) if delay.positive? && i < todo.size - 1
    end
    puts "", "Done: #{created} draft(s) for #{done} topic(s); #{skipped} unusable replies skipped.",
         "Review them at /admin_panel/topicificator?prompts=draft"
  end
end
