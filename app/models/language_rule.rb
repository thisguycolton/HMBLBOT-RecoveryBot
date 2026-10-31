# One entry in the blocked-language list (BlockedLanguage), edited by site admins in the admin
# suite (Content > Blocked words):
#   anywhere - blocked even inside other words ("xxslur", "s l u r")
#   word     - blocked as a whole word or phrase only
#   allowed  - an innocent word or phrase skipped before checking ("snigger", "Maine Coon")
# Empty table = config/blocked_language.yml (the starter list) is used instead.
class LanguageRule < ApplicationRecord
  KINDS = %w[anywhere word allowed].freeze
  CONFIG_KEYS = { "anywhere" => "anywhere", "word" => "words", "allowed" => "allowed" }.freeze

  belongs_to :created_by, class_name: "User", optional: true

  before_validation { self.term = term.to_s.unicode_normalize(:nfkc).downcase.squish }
  before_validation { self.note = note.to_s.squish.first(200).presence }

  validates :kind, inclusion: { in: KINDS }
  validates :term, presence: true, length: { maximum: 60 },
                   format: { with: /\A[\p{L}\p{N}' -]+\z/, message: "can only have letters, numbers, spaces, hyphens and apostrophes" },
                   uniqueness: { scope: :kind, message: "is already on that list" }
  validate do
    # "word" and "anywhere" compare letters, so a block entry needs at least two
    errors.add(:term, "needs at least two letters") if kind != "allowed" && term.to_s.scan(/\p{L}/).size < 2
  end

  # [count, last change] - nil while the table is empty (or not there yet, mid-migration)
  def self.stamp
    count, changed = pick(Arel.sql("COUNT(*)"), Arel.sql("MAX(updated_at)"))
    count.to_i.positive? ? [count, changed] : nil
  rescue ActiveRecord::StatementInvalid, ActiveRecord::ConnectionNotEstablished
    nil
  end

  # The shape BlockedLanguage takes: { "anywhere" => [...], "words" => [...], "allowed" => [...] }
  def self.config
    CONFIG_KEYS.values.index_with { [] }.tap do |config|
      order(:term).pluck(:kind, :term).each { |kind, term| config[CONFIG_KEYS[kind]] << term }
    end
  end

  # Copies the starter list in (skipping what's there already). Used by the migration.
  def self.import_starter_list!
    BlockedLanguage.starter_config.each do |key, terms|
      kind = CONFIG_KEYS.key(key) or next
      Array(terms).each { |term| find_or_create_by!(kind: kind, term: term.to_s.downcase.squish) }
    end
  end

  def as_admin_json
    { id: id, kind: kind, term: term, note: note, created_by: created_by&.display_name, created_at: created_at.iso8601 }
  end
end
