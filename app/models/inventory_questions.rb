# The nightly 10th step's questions. Everyone starts with the Big Book's review (page 86); a
# member can reword, reorder, drop or add questions, or start from another set (TEMPLATES).
# Each is { "key", "text", "open" }: `open` questions are written out, the rest take a yes or
# no and a note. Each night keeps the set it was written with (StepInventory#questions), so
# changing them never changes a night already written.
module InventoryQuestions
  MAX = 25
  TEXT_MAX = 300

  DEFAULT = [
    { "key" => "resentful", "text" => "Was I resentful?" },
    { "key" => "selfish", "text" => "Was I selfish?" },
    { "key" => "dishonest", "text" => "Was I dishonest?" },
    { "key" => "afraid", "text" => "Was I afraid?" },
    { "key" => "apology", "text" => "Do I owe an apology?" },
    { "key" => "kept", "text" => "Have I kept something to myself that I should talk over with another person?" },
    { "key" => "kind", "text" => "Was I kind and loving toward all?" },
    { "key" => "better", "text" => "What could I have done better?", "open" => true },
    { "key" => "others", "text" => "Was I thinking of myself most of the time, or of what I could do for others?", "open" => true },
  ].map { |q| { "open" => false }.merge(q) }.freeze

  TEMPLATES = [
    { "key" => "big-book", "name" => "Big Book, page 86 (the default)", "questions" => DEFAULT },
    { "key" => "four", "name" => "The four: resentment, selfishness, dishonesty, fear (page 84)",
      "questions" => DEFAULT.first(4) + [{ "key" => "spot", "text" => "When these came up, did I ask God to remove them, talk to someone, and turn my thoughts to someone I could help?", "open" => true }] },
    { "key" => "twelve-and-twelve", "name" => "Twelve and Twelve: a balance sheet",
      "questions" => [
        { "key" => "credit", "text" => "Where did I do well today?", "open" => true },
        { "key" => "debit", "text" => "Where did I fall short?", "open" => true },
        { "key" => "motives", "text" => "What were my real motives?", "open" => true },
        { "key" => "apology", "text" => "Do I owe an apology?", "open" => false },
        { "key" => "grateful", "text" => "What am I grateful for tonight?", "open" => true },
      ] },
  ].freeze

  module_function

  def for(user) = user&.inventory_questions.presence || DEFAULT

  # A list someone sent, made safe: known shape, sensible sizes, unique keys
  def clean(list)
    seen = {}
    Array(list).first(MAX).filter_map do |q|
      q = q.respond_to?(:to_unsafe_h) ? q.to_unsafe_h : q.to_h
      q = q.stringify_keys
      text = q["text"].to_s.squish.first(TEXT_MAX)
      next if text.blank?

      key = q["key"].to_s.downcase.gsub(/[^a-z0-9_-]/, "").first(40).presence || "q#{SecureRandom.hex(3)}"
      key = "#{key}-#{SecureRandom.hex(2)}" if seen[key]
      seen[key] = true
      { "key" => key, "text" => text, "open" => ActiveModel::Type::Boolean.new.cast(q["open"]) || false }
    end
  end

  def default?(list) = list.blank? || list == DEFAULT
end
