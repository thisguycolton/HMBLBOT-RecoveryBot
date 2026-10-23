# A written or uploaded document a group keeps: its meeting format, guidelines, treasurer's
# reports, service position descriptions. The kinds are its folders. Who sees one is its
# visibility (see .visible_to). Its history is a list of numbered versions, like commits: each
# save of new text, title or file adds one (GroupDocumentVersion), with who saved it and their
# note, and the newest is always the document as it is. Comments (GroupDocumentComment) are
# off unless the document turns them on (comment_mode), for its editors or for every member.
class GroupDocument < ApplicationRecord
  include Live

  KINDS = %w[format guidelines treasury service outreach other].freeze
  VISIBILITIES = %w[public members hosts keepers].freeze
  STATUSES = %w[draft current archived].freeze
  # Written in the editor (sanitized HTML), or an older one still in Markdown
  FORMATS = %w[html markdown].freeze
  # Who may comment: nobody (the default), the people who can edit it, or every member who can see it
  COMMENT_MODES = %w[off editors members].freeze
  BODY_MAX = 300_000
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
  # The decision by which the group adopted it ("adopted by group conscience on Mar 3")
  belongs_to :approved_by, class_name: "Motion", foreign_key: :approved_by_motion_id, optional: true, inverse_of: :documents
  has_many :versions, -> { order(number: :desc) }, class_name: "GroupDocumentVersion", dependent: :destroy, inverse_of: :group_document
  # replies go with the comment they answer (a cascading key), so these all go at once
  has_many :comments, class_name: "GroupDocumentComment", dependent: :delete_all
  has_one_attached :file

  before_validation { self.title = title.to_s.squish }
  before_validation { self.body = DocumentHtml.sanitize(body) if body_format == "html" && body.present? }
  before_validation(on: :create) { self.position = (group.documents.where(kind: kind).maximum(:position) || 0) + 1 if position.zero? }

  validates :title, presence: true, length: { maximum: 160 }
  validates :kind, inclusion: { in: KINDS }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :status, inclusion: { in: STATUSES }
  validates :body, length: { maximum: BODY_MAX }
  validates :body_format, inclusion: { in: FORMATS }
  validates :comment_mode, inclusion: { in: COMMENT_MODES }
  validate :file_allowed
  validate :approved_by_is_a_passed_decision

  scope :ordered, -> { order(pinned: :desc, position: :asc, title: :asc) }

  # What this person may see. Keepers (see Group#records_editable_by?) see everything; people
  # who can host (Group#can_host?) see current Hosts, Members and Public documents; members
  # current Members and Public ones; anyone else only current Public ones.
  def self.visible_to(group, user)
    docs = group.documents
    return docs if group.records_editable_by?(user)

    docs = docs.where(status: "current")
    return docs.where(visibility: %w[public members hosts]) if group.can_host?(user)

    group.member_or_site_admin?(user) ? docs.where(visibility: %w[public members]) : docs.where(visibility: "public")
  end

  # Documents with every word of the query in their title or text
  def self.search(scope, query)
    words = query.to_s.split.uniq.first(8)
    # the tags of an HTML document aren't what people search for: block ends become spaces,
    # inline tags (bold, links) vanish so "the <b>word</b>" still reads as one
    text = "replace(regexp_replace(regexp_replace(group_documents.body, '</(p|h[1-4]|li|tr|td|th|blockquote|pre)>|<br ?/?>', ' ', 'gi'), '<[^>]*>', '', 'g'), '&amp;', '&')"
    words.reduce(scope) { |docs, w| docs.where("group_documents.title ILIKE :q OR #{text} ILIKE :q", q: "%#{sanitize_sql_like(w)}%") }
  end

  # Who may read and write its comments: nobody while they're off, its editors (record
  # keepers), or every member (who can see it at all; .visible_to decides that)
  def commentable_by?(user)
    case comment_mode
    when "editors" then group.records_editable_by?(user)
    when "members" then group.member_or_site_admin?(user)
    else false
    end
  end

  def self.file_type_for(filename) = FILE_TYPES[File.extname(filename.to_s).delete(".").downcase]

  def served_type = file.attached? ? self.class.file_type_for(file.filename.to_s) : nil
  def inline? = INLINE_TYPES.include?(served_type)

  # The newest version: the document as it is now
  def head = versions.first

  # Changes the document. `attrs` may carry :file (an upload or a blob) and :remove_file. A new
  # document, or a save that changes its title, text or file, becomes a new version (saved by
  # `user`, with their `message`, crediting `contributor_ids`, by default just them); a save
  # that only changes its folder, visibility and the like doesn't. Returns whether it saved.
  def revise(attrs, user, message: nil, kind: "saved", restored_from: nil, contributor_ids: nil)
    attrs = attrs.to_h.symbolize_keys
    upload = attrs.delete(:file)
    remove = ActiveModel::Type::Boolean.new.cast(attrs.delete(:remove_file)) && upload.blank? && file.attached?
    creating = new_record?
    # A document from before version history (or made some other way) starts its history with what it had
    baseline = !creating && !versions.exists? &&
               { user_id: updated_by_id || created_by_id, title: title_in_database, body: body_in_database, body_format: body_format_in_database,
                 created_at: updated_at || Time.current, blob: (file.blob if file.attached?) }

    assign_attributes(attrs)
    self.updated_by = user
    self.file = upload if upload.present?
    content = creating || title_changed? || body_changed? || body_format_changed? || upload.present? || remove

    saved = false
    text_changed = false
    transaction do
      saved = save
      raise ActiveRecord::Rollback unless saved

      text_changed = saved_change_to_title? || saved_change_to_body?
      file.detach if remove
      if baseline && content
        first = versions.create!(baseline.except(:blob).merge(number: 1, kind: "created", contributor_ids: [baseline[:user_id]].compact))
        first.file.attach(baseline[:blob]) if baseline[:blob]
      end
      add_version(user, message: message, kind: creating ? "created" : kind, restored_from: restored_from, contributor_ids: contributor_ids) if content
    end
    versions.reset
    # anyone editing live starts again from the new text (see Live)
    live_reset! if saved && text_changed
    saved
  end

  # Puts an old version back as a new version, so nothing is lost
  def restore(version, user, message: nil)
    attrs = { title: version.title, body: version.body, body_format: version.body_format }
    if version.file.attached?
      attrs[:file] = version.file.blob unless file.attached? && file.blob == version.file.blob
    elsif file.attached?
      attrs[:remove_file] = true
    end
    revise(attrs, user, message: message.presence || "Restored version #{version.number}", kind: "restored", restored_from: version)
  end

  # The start of the text as one plain line (table dividers and Markdown marks left out)
  def excerpt
    return DocumentHtml.text(body).first(160) if body_format == "html"

    body.to_s.lines.reject { |l| l.match?(/\A\s*\|?[\s:|-]+\|?\s*\z/) }.join(" ").delete("#>*_`[]").tr("|", " ").squish.first(160)
  end

  # The excerpt ending on a whole word, with "…" when the text goes on (link previews)
  def summary
    text = excerpt
    text.size < 160 ? text : "#{text.sub(/\s+\S*\z/, '')}…"
  end

  def as_api_json(viewer: nil, full: false)
    json = {
      id: id, title: title, kind: kind, visibility: visibility, status: status, pinned: pinned, position: position,
      updated_at: updated_at.iso8601, updated_by: (updated_by || created_by)&.display_name,
      file: file.attached? ? { name: file.filename.to_s, type: served_type, size: file.byte_size, inline: inline? } : nil,
      excerpt: excerpt,
    }
    json.merge!(body: body.to_s, body_format: body_format, created_at: created_at.iso8601, created_by: created_by&.display_name, approved_by: approved_by_json(viewer),
                comment_mode: comment_mode, version: head&.number) if full
    json
  end

  private

  def add_version(user, message:, kind:, restored_from:, contributor_ids:)
    previous = GroupDocumentVersion.where(group_document_id: id).order(number: :desc).first
    stats = previous ? DocumentDiff.stats(previous.body, body, previous.body_format, body_format) : { words_added: 0, words_removed: 0, sections: [] }
    version = versions.create!(
      number: (previous&.number || 0) + 1, user: user, title: title, body: body, body_format: body_format,
      message: message.to_s.squish.first(280).presence, kind: kind, restored_from_id: restored_from&.id,
      contributor_ids: (Array(contributor_ids).map(&:to_i) + [user&.id]).compact.uniq,
      words_added: stats[:words_added], words_removed: stats[:words_removed], sections_changed: stats[:sections],
    )
    version.file.attach(file.blob) if file.attached?
  end

  # The adopting decision, if this viewer may see it
  def approved_by_json(viewer)
    motion = approved_by
    return unless motion && Motion.visible_to(group, viewer).exists?(motion.id)

    { id: motion.id, title: motion.title, decided_on: motion.decided_on&.iso8601 }
  end

  def approved_by_is_a_passed_decision
    return unless approved_by

    errors.add(:approved_by, "must be a decision this group passed") unless approved_by.group_id == group_id && approved_by.passed?
  end

  def file_allowed
    return unless file.attached?

    name = file.filename.to_s
    errors.add(:file, "needs to be a PDF, Word, Excel or picture file") unless self.class.file_type_for(name)
    errors.add(:file, "needs to be under #{FILE_MAX / 1.megabyte} MB") if file.byte_size > FILE_MAX
  end
end
