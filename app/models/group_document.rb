# A written or uploaded document a group keeps: its meeting format, guidelines, treasurer's
# reports, service position descriptions. The kinds are its folders. Who sees one is its
# visibility (see .visible_to); every save keeps the copy it replaced (GroupDocumentVersion).
class GroupDocument < ApplicationRecord
  KINDS = %w[format guidelines treasury service outreach other].freeze
  VISIBILITIES = %w[public members keepers].freeze
  STATUSES = %w[draft current archived].freeze
  BODY_MAX = 100_000
  FILE_MAX = 20.megabytes
  # What an upload may be, and the type it is served as (only the last two kinds show inline)
  FILE_TYPES = {
    "pdf" => "application/pdf",
    "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "png" => "image/png", "jpg" => "image/jpeg", "jpeg" => "image/jpeg", "webp" => "image/webp", "gif" => "image/gif",
  }.freeze
  INLINE_TYPES = %w[application/pdf image/png image/jpeg image/webp image/gif].freeze

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true
  has_many :versions, -> { order(created_at: :desc, id: :desc) }, class_name: "GroupDocumentVersion", dependent: :destroy
  has_one_attached :file

  before_validation { self.title = title.to_s.squish }
  before_validation(on: :create) { self.position = (group.documents.where(kind: kind).maximum(:position) || 0) + 1 if position.zero? }

  validates :title, presence: true, length: { maximum: 160 }
  validates :kind, inclusion: { in: KINDS }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :status, inclusion: { in: STATUSES }
  validates :body, length: { maximum: BODY_MAX }
  validate :file_allowed

  scope :ordered, -> { order(pinned: :desc, position: :asc, title: :asc) }

  # What this person may see. Keepers (see Group#records_editable_by?) see everything;
  # members see current Members and Public documents; anyone else only current Public ones.
  def self.visible_to(group, user)
    docs = group.documents
    return docs if group.records_editable_by?(user)

    docs = docs.where(status: "current")
    group.member_or_site_admin?(user) ? docs.where(visibility: %w[public members]) : docs.where(visibility: "public")
  end

  def self.search(scope, query)
    like = "%#{sanitize_sql_like(query.to_s.strip)}%"
    scope.where("group_documents.title ILIKE :q OR group_documents.body ILIKE :q", q: like)
  end

  def self.file_type_for(filename) = FILE_TYPES[File.extname(filename.to_s).delete(".").downcase]

  def served_type = file.attached? ? self.class.file_type_for(file.filename.to_s) : nil
  def inline? = INLINE_TYPES.include?(served_type)

  # Changes the document, keeping the copy it had. `attrs` may carry :file (an upload or a
  # blob) and :remove_file. Returns whether it saved; a save that changes nothing makes no
  # version, and neither does a new document.
  def revise(attrs, user)
    attrs = attrs.to_h.symbolize_keys
    upload = attrs.delete(:file)
    remove = ActiveModel::Type::Boolean.new.cast(attrs.delete(:remove_file)) && upload.blank? && file.attached?
    before = { title: title_in_database, body: body_in_database, user_id: updated_by_id || created_by_id,
               at: updated_at || Time.current, blob: (file.blob if file.attached?) }

    assign_attributes(attrs)
    self.updated_by = user
    self.file = upload if upload.present?
    return save if new_record? || !(title_changed? || body_changed? || upload.present? || remove)

    saved = false
    transaction do
      saved = save
      raise ActiveRecord::Rollback unless saved

      file.detach if remove
      version = versions.create!(user_id: before[:user_id], title: before[:title], body: before[:body], created_at: before[:at])
      version.file.attach(before[:blob]) if before[:blob]
    end
    saved
  end

  # Puts an old copy back as a new save, so nothing is lost
  def restore(version, user)
    attrs = { title: version.title, body: version.body }
    if version.file.attached?
      attrs[:file] = version.file.blob unless file.attached? && file.blob == version.file.blob
    elsif file.attached?
      attrs[:remove_file] = true
    end
    revise(attrs, user)
  end

  def as_api_json(viewer: nil, full: false)
    json = {
      id: id, title: title, kind: kind, visibility: visibility, status: status, pinned: pinned, position: position,
      updated_at: updated_at.iso8601, updated_by: (updated_by || created_by)&.display_name,
      file: file.attached? ? { name: file.filename.to_s, type: served_type, size: file.byte_size, inline: inline? } : nil,
      excerpt: excerpt,
    }
    json.merge!(body: body.to_s, created_at: created_at.iso8601, created_by: created_by&.display_name) if full
    json
  end

  private

  # The start of the text as one plain line (table dividers and Markdown marks left out)
  def excerpt
    body.to_s.lines.reject { |l| l.match?(/\A\s*\|?[\s:|-]+\|?\s*\z/) }.join(" ").delete("#>*_`[]").tr("|", " ").squish.first(160)
  end

  def file_allowed
    return unless file.attached?

    name = file.filename.to_s
    errors.add(:file, "needs to be a PDF, Word, Excel or picture file") unless self.class.file_type_for(name)
    errors.add(:file, "needs to be under #{FILE_MAX / 1.megabyte} MB") if file.byte_size > FILE_MAX
  end
end
