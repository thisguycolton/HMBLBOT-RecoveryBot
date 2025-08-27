# app/controllers/api/chapters_controller.rb
class Api::ChaptersController < ApplicationController
  before_action :set_book
  before_action :set_chapter, only: [:show, :update, :destroy]

    def destroy
      @chapter.destroy!
      # optional: keep indices compact if you rely on strict 1..N
      # renumber!(@book)
      head :no_content
    rescue => e
      render json: { error: e.message }, status: :unprocessable_entity
    end

def create
  p = params.require(:chapter).permit(:title, :slug, :first_page, :last_page)
  next_index = (@book.chapters.maximum(:index) || 0) + 1
  ch = @book.chapters.create!(
    title:       p[:title].presence || "Untitled",
    slug:        slugify(p[:slug].presence || "chapter-#{next_index}"),
    index:       next_index,
    first_page:  p[:first_page],
    last_page:   p[:last_page],
    tiptap_json: { "type" => "doc", "content" => [] }
  )
  render json: ch.slice(:id, :slug, :title, :index, :first_page, :last_page), status: :created
end

  def index
  chapters = @book.chapters.order(:index)

  render json: chapters.map { |c|
    c.as_json(
      only: [:id, :slug, :title, :index, :first_page, :last_page],
      methods: [:paragraph_count]
    ).merge(book_title: @book.title)
  }
end

  def show
    render json: {
      id: @chapter.id,
      slug: @chapter.slug,
      title: @chapter.title,
      index: @chapter.index,
      tiptap_json: @chapter.tiptap_json,
      first_page: @chapter.first_page,
      last_page: @chapter.last_page
    }
  end

  def update
    # Only allow non-index attributes from this endpoint
    if @chapter.update(chapter_params)
      render json: @chapter, status: :ok
    else
      render json: { errors: @chapter.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /api/books/:book_slug/chapters/merge
  # params: { source_slugs: [], target_slug: 'bigbook-4e-ch22' } OR { source_slugs: [], new_title: '…', new_slug: '…' }
# POST /api/books/:book_slug/chapters/merge
# Params:
#   source_slugs: [slug1, slug2, ...] (>= 2, order matters)
#   target_slug: optional, merge into this existing chapter
#   new_title:   if creating a new target
#   new_slug:    if creating a new target
# app/controllers/api/chapters_controller.rb
# controllers/api/chapters_controller.rb
def merge
  Book.transaction do
    p = merge_params

    # 1) Normalize inputs
    source_slugs = Array(p[:source_slugs]).map(&:to_s).uniq
    raise ActionController::BadRequest, "Need at least 2 chapters" if source_slugs.size < 2

    book = @book
    sources = book.chapters.where(slug: source_slugs).order(:index).to_a
    missing = source_slugs - sources.map(&:slug)
    raise ActiveRecord::RecordNotFound, "Missing chapters: #{missing.join(', ')}" if missing.any?

    target =
      if p[:target_slug].present?
        book.chapters.find_by!(slug: p[:target_slug].to_s)
      else
        # default: the lowest-index chapter becomes the target
        sources.min_by(&:index)
      end

    merge_sources = sources.reject { |ch| ch.id == target.id }
    raise ActionController::BadRequest, "Nothing to merge into target" if merge_sources.empty?

    # 2) Build merged doc and record offsets (plain-text lengths)
    merged_doc        = { "type" => "doc", "content" => [] }
    offsets_plain     = {} # chapter_id => plain length where that chapter begins
    running_plain_len = 0

    all_in_order = [target, *merge_sources].sort_by(&:index)

    all_in_order.each_with_index do |src, i|
      # record where this chapter will start in merged plain text
      offsets_plain[src.id] = running_plain_len

      if i > 0
        merged_doc["content"] << {
          "type"  => "pageBreak",
          "attrs" => { "kind" => "chapterDivider", "title" => src.title, "page" => nil }
        }
        running_plain_len = plain_length(merged_doc)
      end

      src_doc      = src.tiptap_json.is_a?(Hash) ? src.tiptap_json : { "type" => "doc", "content" => [] }
      src_content  = Array(src_doc["content"])
      src_plainlen = plain_length(src_doc)

      merged_doc["content"].concat(src_content)
      running_plain_len += src_plainlen
    end

    first_page = all_in_order.map(&:first_page).compact.min
    last_page  = all_in_order.map(&:last_page).compact.max

    # 3) Preview mode (no writes)
    if ActiveModel::Type::Boolean.new.cast(p[:preview])
      render json: {
        ok: true,
        preview: {
          target_slug: target.slug,
          new_title:   p[:new_title].presence || target.title,
          new_slug:    p[:new_slug].presence  || target.slug,
          first_page:  first_page,
          last_page:   last_page,
          length_plain: plain_length(merged_doc),
        }
      }
      raise ActiveRecord::Rollback
    end

    # 4) Apply changes safely
    max_index  = (book.chapters.maximum(:index) || 0)
    temp_index = max_index + 100_000
    target.update_columns(index: temp_index) if target.index && target.index <= max_index

    new_title = p[:new_title].presence || target.title
    new_slug  = p[:new_slug].presence  || target.slug

    target.update!(
      title:       new_title,
      slug:        slugify(new_slug),
      tiptap_json: merged_doc,
      first_page:  first_page,
      last_page:   last_page
    )

    # 5) Move highlights from non-target sources using their starting offsets
    merge_sources.each do |src|
      add_offset = offsets_plain[src.id] || 0
      move_highlights!(from: src, to: target, add_offset: add_offset)
    end

    # 6) Delete merged sources (never delete target)
    merge_sources.each { |src| src.destroy! }

    # 7) Renumber compactly 1..N
    renumber!(book)

    render json: { ok: true, target_slug: target.slug }
  end
end



def reorder
  order = params.require(:order)
  raise ArgumentError, "order must be an array" unless order.is_a?(Array)

  slugs = order.map { |row| row[:slug] || row['slug'] }.compact
  raise ArgumentError, "empty order" if slugs.empty?

  chapters_by_slug = @book.chapters.where(slug: slugs).index_by(&:slug)
  missing  = slugs - chapters_by_slug.keys
  raise ActiveRecord::RecordNotFound, "missing chapters: #{missing.join(', ')}" if missing.any?

  final_pairs = order.map do |row|
    s = (row[:slug]  || row['slug']).to_s
    i = (row[:index] || row['index']).to_i
    raise ArgumentError, "index must be >= 1" if i < 1
    [s, i]
  end

  @book.with_lock do
    ActiveRecord::Base.transaction do
      # Ensure no NULLs (avoid partial-index surprises)
      @book.chapters.where(index: nil).update_all(index: 0)

      # Move everyone out of the way (still unique inside a book)
      @book.chapters.update_all(%q{"index" = "index" + 100000})

      # Apply the requested final indices
      final_pairs.each do |slug, idx|
        chapters_by_slug[slug].update_columns(index: idx) # columns = skip validations
      end
    end
  end

  head :no_content
rescue => e
  render json: { error: e.message }, status: :unprocessable_entity
end

private

def merge_params
  # top-level params (not nested)
  params.permit(:target_slug, :new_title, :new_slug, :preview, source_slugs: [])
end

def slugify(s)
  s.to_s.downcase.strip
    .gsub(/['"]/, "")
    .gsub(/[^a-z0-9]+/, "-")
    .gsub(/^-+|-+$/, "")
end



def slugify(s)
  s.to_s.downcase.strip.gsub(/['"]/, "").gsub(/[^a-z0-9]+/, "-").gsub(/^-+|-+$/, "")
end

def renumber!(book)
  book.with_lock do
    # Phase A: push everyone up to clear uniqueness constraints during rewrites
    Chapter.where(book_id: book.id).update_all(%q{"index" = "index" + 100000})

    # Phase B: write the final 1..N sequence
    ids = book.chapters.order(:index, :id).pluck(:id)
    ids.each_with_index do |id, i|
      Chapter.where(id: id).update_all(index: i + 1)
    end
  end
end

def slugify(s)
  s.to_s.parameterize.presence || SecureRandom.hex(4)
end

def plain_length(doc)
  return 0 unless doc.is_a?(Hash)
  total = 0
  stack = Array(doc["content"])
  while (node = stack.shift)
    if node.is_a?(Hash)
      total += node["text"].to_s.length if node["type"] == "text"
      children = node["content"]
      stack.concat(children) if children.is_a?(Array)
    end
  end
  total
end

def move_highlights!(from:, to:, add_offset:)
  return unless from.respond_to?(:user_highlights) && to.present?
  from.user_highlights.find_each do |uh|
    sel = JSON.parse(uh.selector || "{}") rescue {}
    if sel.dig("position", "type") == "TextPositionSelector"
      sel["position"]["start"] = sel["position"]["start"].to_i + add_offset
      sel["position"]["end"]   = sel["position"]["end"].to_i + add_offset
    end
    to.user_highlights.create!(
      user_id:  uh.user_id,
      selector: sel.to_json,
      style:    uh.style,
      note:     uh.note
    )
    uh.destroy!
  end
end

  def set_book
    @book = Book.find_by!(slug: params[:book_slug])
  end

  def set_chapter
    @chapter = @book.chapters.find_by!(slug: params[:slug])
  end

  def chapter_params
    params.require(:chapter).permit(
      :title,
      :slug,
      :first_page,
      :last_page,
      :source_slugs,
      :target_slug,
      :new_title,
      :new_slug,
      :preview,
      tiptap: {},        # if you send tiptap JSON as `tiptap`
      tiptap_json: {}    # or as `tiptap_json`
    )
  end
end
