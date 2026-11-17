# A section of the Docs (/docs/:slug): "Group tools", "Step work and recovery"... Its pages are
# DocPage. Made and renamed by site admins in the docs editor; the first ones come from
# db/docs/<NN-slug>/_section.md (DocsImport). A section whose `kind` is "news" holds news posts
# (DocPage#news?): newest first, and its featured posts lead the News block on the Docs home.
class DocSection < ApplicationRecord
  KINDS = %w[guides news].freeze

  has_many :pages, -> { order(:position, :id) }, class_name: "DocPage", dependent: :destroy, inverse_of: :section

  validates :title, presence: true, length: { maximum: 120 }
  validates :summary, length: { maximum: 500 }
  validates :slug, presence: true, uniqueness: true, format: { with: DocPage::SLUG }
  validates :kind, inclusion: { in: KINDS }

  before_validation do
    self.title = title.to_s.squish
    self.slug = (slug.presence || title).to_s.parameterize.first(60)
    self.summary = summary.to_s.strip.presence
  end

  scope :ordered, -> { order(:position, :id) }
  scope :news, -> { where(kind: "news") }

  def path = "/docs/#{slug}"
  def news? = kind == "news"

  def as_api_json(pages)
    pages = DocPage.newest_first(pages) if news?
    { id: id, slug: slug, title: title, summary: summary, icon: icon, position: position, path: path, kind: kind,
      pages: pages.map(&:as_nav_json) }
  end
end
