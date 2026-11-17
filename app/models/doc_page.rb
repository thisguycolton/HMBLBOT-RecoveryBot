# One page of the Docs (/docs/:section/:slug): a tutorial for a tool, written in Markdown
# (`body`) in the docs editor (components/docs/DocEditor.jsx). Site admins (User#suite_admin?)
# edit every page and see drafts; everyone else reads published pages their `audience` allows:
# everyone (no account needed), members (signed in) or admins. `reviewed_at` is empty for the
# seeded drafts until someone reads one through and ticks Reviewed. A page with a `path_alias`
# ("about", "history") is also served at /about, /history. Each save that changes the text
# keeps the copy it replaced (DocPageVersion), one per editor per few minutes of autosaving.
#
# Pages in a news section (DocSection#news?) are news posts: blog posts and site news. They carry
# a date (`published_at`, set the first time the post is published), a `news_kind` (Blog, Site
# news, Update), an optional `cover_image` (a picture on this site, never another site's, so no
# outside service sees readers) and `featured`. The Docs home leads with featured posts, then the
# newest (DocPage.news_feed).
class DocPage < ApplicationRecord
  SLUG = /\A[a-z0-9][a-z0-9-]{0,59}\z/
  STATUSES = %w[draft published].freeze
  AUDIENCES = %w[everyone members admins].freeze
  ALIASES = %w[about history].freeze
  VERSION_WINDOW = 10.minutes
  BODY_LIMIT = 200_000
  NEWS_KINDS = { "blog" => "Blog", "news" => "Site news", "update" => "Update" }.freeze
  NEWS_FEED_SIZE = 4
  COVER = %r{\A/(?!/)[^\s"'<>]*\z}

  belongs_to :section, class_name: "DocSection", foreign_key: :doc_section_id, inverse_of: :pages
  belongs_to :updated_by, class_name: "User", optional: true
  belongs_to :reviewed_by, class_name: "User", optional: true
  has_many :versions, -> { order(created_at: :desc, id: :desc) }, class_name: "DocPageVersion", dependent: :delete_all
  has_many_attached :images
  has_many_attached :videos # uploaded for ```video blocks (Api::DocsController#videos)

  validates :title, presence: true, length: { maximum: 160 }
  validates :summary, length: { maximum: 400 }
  validates :body, length: { maximum: BODY_LIMIT }
  validates :slug, presence: true, uniqueness: { scope: :doc_section_id }, format: { with: SLUG }
  validates :status, inclusion: { in: STATUSES }
  validates :audience, inclusion: { in: AUDIENCES }
  validates :path_alias, inclusion: { in: ALIASES }, uniqueness: true, allow_nil: true
  validates :news_kind, inclusion: { in: NEWS_KINDS.keys }, allow_nil: true
  validates :cover_image, format: { with: COVER, message: "must be a picture on RecoveryBot (an address starting with /)" }, length: { maximum: 500 }, allow_nil: true

  before_validation do
    self.title = title.to_s.squish
    self.slug = (slug.presence || title).to_s.parameterize.first(60)
    self.summary = summary.to_s.squish.presence
    self.path_alias = path_alias.presence
    self.body = body.to_s.gsub("\r\n", "\n")
    self.news_kind = news_kind.presence
    self.cover_image = cover_image.to_s.strip.presence
    # A post's date is when it first went out; editors can change it
    self.published_at ||= Time.current if published? && section&.news?
  end

  scope :ordered, -> { joins(:section).order("doc_sections.position", "doc_sections.id", :position, :id) }
  scope :published, -> { where(status: "published") }
  scope :news, -> { joins(:section).merge(DocSection.news) }

  # Posts newest first; ones not out yet (drafts with no date) at the top for editors
  def self.newest_first(pages)
    pages.sort_by { |p| [p.published_at ? 1 : 0, -(p.published_at || p.created_at).to_f, -p.id.to_i] }
  end

  # The News block on the Docs home: featured posts first, then the newest, that this person may read
  def self.news_feed(user, limit: NEWS_FEED_SIZE)
    readable_by(user).published.news.includes(:section)
                     .order(featured: :desc, published_at: :desc, id: :desc).limit(limit)
  end

  def self.editor?(user) = !!user&.suite_admin?

  # What this person may read: editors everything, others published pages for their audience
  def self.readable_by(user)
    return all if editor?(user)

    audiences = ["everyone"]
    audiences << "members" if user
    audiences << "admins" if user&.admin?
    published.where(audience: audiences)
  end

  def readable_by?(user) = self.class.readable_by(user).exists?(id)
  def published? = status == "published"
  def reviewed? = reviewed_at.present?
  def news? = !!section&.news?

  def path = path_alias ? "/#{path_alias}" : "/docs/#{section.slug}/#{slug}"
  def docs_path = "/docs/#{section.slug}/#{slug}"

  # Saves an edit by `user`, keeping the text it replaces (unless this editor's last kept copy is
  # only a few minutes old: autosave shouldn't fill History with every pause)
  def save_edit(attrs, user)
    assign_attributes(attrs)
    self.updated_by = user
    transaction do
      record_version(user) if persisted? && (will_save_change_to_body? || will_save_change_to_title?)
      save!
    end
    true
  rescue ActiveRecord::RecordInvalid
    false
  end

  def restore!(version, user)
    transaction do
      versions.create!(title: title, body: body, saved_by: user)
      update!(title: version.title, body: version.body, updated_by: user)
    end
  end

  def mark_reviewed!(on, user)
    update!(reviewed_at: on ? Time.current : nil, reviewed_by: on ? user : nil)
  end

  # Plain words, for search snippets and the share description
  def plain_text
    body.to_s.gsub(/```.*?```/m, " ").gsub(/!\[[^\]]*\]\([^)]*\)/, " ").gsub(/\[([^\]]*)\]\([^)]*\)/, '\1')
        .gsub(/^\s*>\s?\[!\w+\]/, " ").gsub(/[*_`~]+/, "").gsub(/[#>|]+/, " ").gsub(/^\s*[-+]\s+(\[[ x]\]\s*)?/, " ").squish
  end

  def snippet(query, around: 80)
    text = plain_text
    at = text.downcase.index(query.downcase)
    return text.truncate(around * 2, separator: " ") unless at

    from = [at - around, 0].max
    piece = text[from, query.length + (around * 2)]
    "#{'…' if from.positive?}#{piece.strip}#{'…' if from + piece.length < text.length}"
  end

  def as_nav_json
    json = { id: id, slug: slug, title: title, summary: summary, icon: icon, path: path, docs_path: docs_path,
             status: status, audience: audience, reviewed: reviewed?, position: position }
    json.merge!(news_json) if news?
    json
  end

  def news_json
    { news_kind: news_kind, news_label: NEWS_KINDS[news_kind || "news"], featured: featured,
      published_at: published_at&.iso8601, cover_image: cover_image }
  end

  # A card in the News block on the Docs home
  def as_news_json
    { id: id, title: title, summary: summary.presence || plain_text.truncate(180, separator: " "), path: path, status: status }.merge(news_json)
  end

  def as_api_json(editor: false)
    json = as_nav_json.merge(
      section: { id: section.id, slug: section.slug, title: section.title, path: section.path, kind: section.kind },
      body: body, updated_at: updated_at.iso8601, path_alias: path_alias,
    )
    if editor
      json.merge!(doc_section_id: doc_section_id, updated_by: updated_by&.display_name,
                  reviewed_at: reviewed_at&.iso8601, reviewed_by: reviewed_by&.display_name)
    end
    json
  end

  private

  def record_version(user)
    last = versions.first
    return if last && last.saved_by_id == user&.id && last.created_at > VERSION_WINDOW.ago && updated_by_id_was == user&.id

    versions.create!(title: title_was.presence || title, body: body_was.to_s, saved_by: user)
  end
end
