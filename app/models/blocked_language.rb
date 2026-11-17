# Finds racist slurs and hate speech in text people write, including the usual ways of sneaking
# them past a filter (l33t, spacing, symbols, repeated letters, look-alike letters, invisible
# characters). Ordinary swearing is fine. The list is LanguageRule (edited in the admin suite),
# or config/blocked_language.yml while that's empty.
#
#   BlockedLanguage.found?("some text")  # => true / false
#   BlockedLanguage.match("some text")   # => the offending bit as written, or nil
#
# Models use it through `moderates_language` (see ModeratesLanguage).
class BlockedLanguage
  CONFIG = Rails.root.join("config/blocked_language.yml")

  MESSAGE = "has a slur or hateful word in it. Ordinary swearing is fine, but racist slurs and hate speech aren't allowed here."

  # Stand-ins for each letter (besides the letter itself). `l` for `i` only counts in the
  # `anywhere` words, since "yld" or "pakl" are too likely to be something else.
  LEET = {
    "a" => "4@", "b" => "8", "e" => "3", "g" => "96", "i" => "1!|", "o" => "0",
    "s" => "5$z", "t" => "7+", "z" => "s"
  }.freeze
  VOWELS = "aeiouy".freeze

  # Letters from other alphabets that look like Latin ones (fullwidth and math letters are
  # already folded by NFKD)
  LOOKALIKES = {
    "а" => "a", "в" => "b", "е" => "e", "к" => "k", "м" => "m", "н" => "h", "о" => "o", "р" => "p",
    "с" => "c", "т" => "t", "у" => "y", "х" => "x", "і" => "i", "ј" => "j", "ѕ" => "s", "ԁ" => "d",
    "ԛ" => "q", "ԝ" => "w", "ү" => "y", "һ" => "h", "ӏ" => "l", "ɡ" => "g", "ɑ" => "a", "ı" => "i",
    "ɩ" => "i", "α" => "a", "β" => "b", "ε" => "e", "η" => "n", "ι" => "i", "κ" => "k", "ν" => "v",
    "ο" => "o", "ρ" => "p", "τ" => "t", "υ" => "u", "χ" => "x", "ϲ" => "c", "ɢ" => "g", "ɴ" => "n",
    "ɪ" => "i", "ʀ" => "r", "ᴀ" => "a", "ᴇ" => "e", "ᴋ" => "k", "ᴏ" => "o", "ᴘ" => "p", "ᴛ" => "t"
  }.freeze
  LOOKALIKE_FROM = LOOKALIKES.keys.join.freeze
  LOOKALIKE_TO = LOOKALIKES.values.join.freeze

  INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯︀-️﻿]/
  BLOCK_TAG = %r{</?(?:p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|blockquote|section|details|summary|pre|hr)\b[^>]*>}i
  # letters spelled out one at a time: "n i g g e r", "s.p.i.c"
  SPELLED_OUT = /(?<![\p{L}\p{N}])[\p{L}\p{N}](?:[^\p{L}\p{N}]{1,3}[\p{L}\p{N}](?![\p{L}\p{N}])){2,}/
  # long strings with no spaces (data: URLs, tokens, base64) aren't writing
  NOT_WRITING = %r{\A(?:data:|https?://)|\A\S{120,}\z}

  class << self
    # Rebuilt whenever the list changes (any app process, since it's checked against the table)
    def instance
      stamp = LanguageRule.stamp
      if @instance.nil? || stamp != @stamp
        @instance = new(stamp ? LanguageRule.config : starter_config)
        @stamp = stamp
      end
      @instance
    end

    def reload! = @instance = nil
    def starter_config = YAML.load_file(CONFIG)

    def found?(*texts) = texts.any? { |text| instance.match(text) }
    def match(text) = instance.match(text)
    def message = MESSAGE

    # Every string in a JSON value (blocks, answers, ...), skipping links and embedded files
    def strings_in(value, into = [])
      case value
      when String then into << value unless value.match?(NOT_WRITING)
      when Hash then value.each_value { |v| strings_in(v, into) }
      when Array then value.each { |v| strings_in(v, into) }
      end
      into
    end
  end

  def initialize(config)
    @allowed = Array(config["allowed"]).map { |phrase| allowed_pattern(phrase) }
    # stand-ins only when the letters are together; spaced out, only real letters count (so
    # "in 1966. a" isn't one)
    anywhere = Array(config["anywhere"]).flat_map { |term| [term_pattern(term, anywhere: true), term_pattern(term, anywhere: true, spaced: true)] }
    words = Array(config["words"]).map { |term| term_pattern(term, anywhere: false) }
    @anywhere = anywhere.any? ? Regexp.new("(?:#{anywhere.join("|")})", Regexp::IGNORECASE) : nil
    @words = words.any? ? Regexp.new("(?<![\\p{L}\\p{N}])(?:#{words.join("|")})[sz5$]*(?![\\p{L}\\p{N}])", Regexp::IGNORECASE) : nil
  end

  # The offending bit (from the cleaned-up text), or nil
  def match(text)
    return nil if text.blank?

    cleaned = clean(text.to_s)
    @allowed.each { |pattern| cleaned = cleaned.gsub(pattern) { |m| " " * m.length } }
    spelled = cleaned.scan(SPELLED_OUT).map { |run| run.gsub(/[^\p{L}\p{N}]/, "") }

    [cleaned, *spelled].each do |candidate|
      found = (@anywhere && candidate[@anywhere]) || (@words && candidate[@words])
      return found if found
    end
    nil
  end

  private

  # Lowercase, no HTML tags, no accents, no invisible characters, look-alikes folded to Latin
  def clean(text)
    if text.include?("<")
      text = text.gsub(BLOCK_TAG, " ")
      text = ActionView::Base.full_sanitizer.sanitize(text).to_s
    end
    text = CGI.unescapeHTML(text) if text.include?("&")
    text = text.unicode_normalize(:nfkd) if text.valid_encoding?
    text.gsub(/\p{Mn}/, "").gsub(INVISIBLE, "").downcase.tr(LOOKALIKE_FROM, LOOKALIKE_TO).gsub(/\s+/, " ")
  end

  # "coon hound" -> whole words, the space also matching a hyphen or nothing
  def allowed_pattern(phrase)
    words = phrase.downcase.split(/[^\p{L}\p{N}']+/).compact_blank.map { |w| Regexp.escape(w) }
    Regexp.new("(?<![\\p{L}\\p{N}])#{words.join("[\\s\\-]*")}(?![\\p{L}\\p{N}])", Regexp::IGNORECASE)
  end

  # "nigger" -> n+ [i1!|l*]+ [g96]+ ... ; phrases allow any punctuation/space between words.
  # `spaced` (for `anywhere` words) allows a few spaces/symbols between the letters instead of
  # stand-ins ("nig ger", "n_i_g").
  def term_pattern(term, anywhere:, spaced: false)
    letters = term.downcase.strip.chars
    repeat = anywhere || letters.count { |c| c.match?(/[a-z]/) } >= 5
    parts = letters.map do |c|
      next "[^\\p{L}\\p{N}]*" if c.match?(/[^a-z]/)

      stand_ins = spaced ? "" : LEET[c].to_s + (anywhere && c == "i" ? "l" : "") + (VOWELS.include?(c) ? "*" : "")
      klass = "[#{(c + stand_ins).chars.uniq.map { |ch| Regexp.escape(ch) }.join}]"
      repeat ? "#{klass}+" : klass
    end
    parts.join(spaced ? "[^\\p{L}\\p{N}]{0,3}" : "")
  end
end
