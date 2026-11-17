# A site-wide step worksheet, made in Site Admin > Step worksheets: what members start from on
# the Steps page (StepTool reads the published ones). `draft` is what admins are editing, and
# only they see it; publishing makes it the next version (StepTemplateVersion) and the one new
# worksheets start from. Work members already started never changes, since each StepWork keeps
# its own copy of the definition. The name, summary, steps and the rest change as they save.
# The built-ins were copied in from config/step_tools/*.yml by a migration; while this table is
# empty (tests) StepTool reads those files instead.
class StepTemplate < ApplicationRecord
  belongs_to :created_by, class_name: "User", optional: true
  has_many :versions, -> { order(:number) }, class_name: "StepTemplateVersion", dependent: :destroy

  validates :key, presence: true, uniqueness: true, format: { with: /\A[a-z0-9][a-z0-9-]{0,59}\z/ }
  validates :name, presence: true, length: { maximum: 200 }
  validates :summary, length: { maximum: 500 }
  validates :credit, length: { maximum: 300 }
  validates :step, inclusion: { in: StepTool::STEPS }
  validate { errors.add(:steps, "must be from 1 to 12") unless steps.present? && steps.all? { |s| StepTool::STEPS.include?(s) } }

  before_validation do
    self.steps = Array(steps).map(&:to_i).select { |s| StepTool::STEPS.include?(s) }.uniq.sort.presence || [step.to_i]
    self.step = steps.first if step.blank? || !steps.include?(step)
    self.name = name.to_s.strip
    self.summary = summary.to_s.strip.presence
    self.credit = credit.to_s.strip.presence
  end
  # One default for each step: making this one the default stops the others being it
  after_save :one_default, if: -> { saved_change_to_default? && default? }

  scope :listed, -> { where(hidden: false).where.not(definition: nil) }
  scope :ordered, -> { order(:step, default: :desc, position: :asc, name: :asc) }

  # Raises StepTool::Invalid when the draft can't be used
  def draft=(definition)
    super(StepTool.clean(definition))
  end

  def published? = version.positive?
  def changed_since_publish? = !published? || draft != definition

  def publish!(by)
    transaction do
      next_version = version + 1
      versions.create!(number: next_version, name: name, definition: draft, published_by: by)
      update!(definition: draft, version: next_version, published_at: Time.current)
    end
    versions.reset
  end

  # A new draft from an earlier version (history is never rewritten)
  def restore!(number)
    update!(draft: versions.find_by!(number: number).definition)
  end

  # What StepTool works with: the published version
  def to_tool
    StepTool.new(definition.merge("key" => key, "step" => step, "steps" => steps, "name" => name, "summary" => summary,
                                  "credit" => credit.presence || definition["credit"], "default" => default?, "version" => version))
  end

  # A new worksheet, or one from a file (JSON or YAML, the shape of config/step_tools/*.yml)
  def self.from_file(text, by:)
    data = begin
      JSON.parse(text)
    rescue JSON::ParserError
      YAML.safe_load(text.to_s)
    end
    raise StepTool::Invalid, "That file isn't a worksheet." unless data.is_a?(Hash)

    step = data["step"].to_i
    build(by: by, step: step, name: data["name"], definition: data.slice("intro", "sections", "credit", "layout"),
          summary: data["summary"], credit: data["credit"], steps: data["steps"], key: data["key"])
  rescue Psych::Exception
    raise StepTool::Invalid, "That file isn't JSON or YAML."
  end

  def self.build(by:, step:, name:, definition: nil, summary: nil, credit: nil, steps: nil, key: nil)
    step = step.to_i
    raise StepTool::Invalid, "Pick a step from 1 to 12." unless StepTool::STEPS.include?(step)

    name = name.to_s.strip.presence || "New Step #{step} worksheet"
    key = free_key(key.to_s.parameterize.presence || "step#{step}-#{name.parameterize}".first(50))
    new(key: key, step: step, steps: steps || [step], name: name, summary: summary, credit: credit, created_by: by,
        draft: definition.presence || StepTool.blank(step), position: (maximum(:position) || 0) + 1)
  end

  def self.free_key(base)
    base = base.first(50).delete_suffix("-")
    key = base
    n = 1
    key = "#{base}-#{n += 1}" while exists?(key: key)
    key
  end

  # For the list: no answers, only how many people started it
  def as_admin_json(started: nil)
    { id: id, key: key, step: step, steps: steps, name: name, summary: summary, credit: credit, default: default?, hidden: hidden,
      version: version, published_at: published_at&.iso8601, updated_at: updated_at.iso8601, changed: changed_since_publish?,
      sections: (draft["sections"] || []).size, started: started }.compact
  end

  # For the editor: the draft and the published version, and every version so far
  def as_editor_json
    as_admin_json.merge(draft: draft, definition: definition,
                        versions: versions.includes(:published_by).reverse.map { |v| { number: v.number, name: v.name, at: v.created_at.iso8601, by: v.published_by&.display_name } })
  end

  private

  def one_default
    self.class.where.not(id: id).where("steps && ARRAY[?]::integer[]", steps).where(default: true).update_all(default: false)
  end
end
