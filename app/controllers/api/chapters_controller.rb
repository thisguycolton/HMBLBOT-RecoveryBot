# app/controllers/api/chapters_controller.rb
class Api::ChaptersController < ApplicationController
  before_action :set_book
  before_action :set_chapter, only: [:show, :update, :destroy]

  # --------------------------------------------------------------------------
  # DELETE /api/books/:book_slug/chapters/:slug
  # --------------------------------------------------------------------------

  def destroy
    @chapter.destroy!
    renumber!(@book)
    head :no_content
  rescue => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # --------------------------------------------------------------------------
  # POST /api/books/:book_slug/chapters
  # --------------------------------------------------------------------------

  def create
    p = params.require(:chapter).permit(
      :title,
      :slug,
      :first_page,
      :last_page
    )

    next_index = (@book.chapters.maximum(:index) || 0) + 1

    chapter = @book.chapters.create!(
      title: p[:title].presence || "Untitled",
      slug: slugify(p[:slug].presence || "chapter-#{next_index}"),
      index: next_index,
      first_page: p[:first_page],
      last_page: p[:last_page],
      tiptap_json: {
        "type" => "doc",
        "content" => []
      }
    )

    render json: chapter.slice(
      :id,
      :slug,
      :title,
      :index,
      :first_page,
      :last_page
    ), status: :created

  rescue => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # --------------------------------------------------------------------------
  # GET /api/books/:book_slug/chapters
  # --------------------------------------------------------------------------

  def index
    chapters = @book.chapters.order(:index, :id)

    render json: chapters.map { |chapter|
      chapter.as_json(
        only: [
          :id,
          :slug,
          :title,
          :index,
          :first_page,
          :last_page
        ],
        methods: [:paragraph_count]
      ).merge(
        book_title: @book.title
      )
    }
  end

  # --------------------------------------------------------------------------
  # GET /api/books/:book_slug/chapters/:slug
  # --------------------------------------------------------------------------

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

  # --------------------------------------------------------------------------
  # PATCH /api/books/:book_slug/chapters/:slug
  # --------------------------------------------------------------------------

  def update
    if @chapter.update(chapter_params)
      render json: @chapter, status: :ok
    else
      render json: {
        errors: @chapter.errors.full_messages
      }, status: :unprocessable_entity
    end

  rescue => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # ==========================================================================
  # MERGE
  # ==========================================================================
  #
  # POST /api/books/:book_slug/chapters/merge
  #
  # {
  #   "source_slugs": ["chapter-a", "chapter-b"],
  #   "target_slug": "chapter-a"
  # }
  #
  # Optional:
  #   new_title
  #   new_slug
  #   preview
  #
  # The target chapter survives.
  # All source chapters are merged INTO the target and then deleted.
  #
  # ==========================================================================

  # POST /api/books/:book_slug/chapters/merge
#
# Params:
#   source_slugs: [slug1, slug2, ...]
#   target_slug: optional existing chapter to merge into
#   new_title: optional replacement title
#   new_slug: optional replacement slug
#   preview: optional boolean
#
def merge
  p = merge_params

  source_slugs = Array(p[:source_slugs]).map(&:to_s).uniq

  raise ActionController::BadRequest, "Need at least 2 chapters" if source_slugs.length < 2

  book = @book
  merge_result = nil

  Book.transaction do
    # ------------------------------------------------------------------
    # 1. Load chapters in their actual book order
    # ------------------------------------------------------------------

    chapters = book.chapters
      .where(slug: source_slugs)
      .order(:index, :id)
      .to_a

    missing = source_slugs - chapters.map(&:slug)

    if missing.any?
      raise ActiveRecord::RecordNotFound,
        "Missing chapters: #{missing.join(', ')}"
    end

    target =
      if p[:target_slug].present?
        book.chapters.find_by!(slug: p[:target_slug].to_s)
      else
        chapters.first
      end

    unless chapters.any? { |chapter| chapter.id == target.id }
      raise ActionController::BadRequest, "The merge target must be one of the selected chapters"
    end

    sources = chapters.reject { |chapter| chapter.id == target.id }

    raise ActionController::BadRequest,
      "Nothing to merge into target" if sources.empty?

    # ------------------------------------------------------------------
    # 2. IMPORTANT:
    #    Always merge in the ORIGINAL chapter order.
    # ------------------------------------------------------------------

    merge_chapters = [target, *sources].sort_by { |chapter| [chapter.index, chapter.id] }

    # ------------------------------------------------------------------
    # 3. Build merged TipTap document completely in memory.
    # ------------------------------------------------------------------

    merged_content = []

    merge_chapters.each_with_index do |chapter, i|
      if i > 0
        merged_content << {
          "type" => "pageBreak",
          "attrs" => {
            "kind" => "chapterDivider",
            "title" => chapter.title,
            "page" => nil
          }
        }
      end

      doc =
        if chapter.tiptap_json.is_a?(Hash)
          chapter.tiptap_json.deep_dup
        else
          {
            "type" => "doc",
            "content" => []
          }
        end

      content = Array(doc["content"]).deep_dup

      merged_content.concat(content)
    end

    merged_doc = {
      "type" => "doc",
      "content" => merged_content
    }

    # ------------------------------------------------------------------
    # 4. Preview
    # ------------------------------------------------------------------

    first_page = merge_chapters.map(&:first_page).compact.min
    last_page  = merge_chapters.map(&:last_page).compact.max

    if ActiveModel::Type::Boolean.new.cast(p[:preview])
      merge_result = {
        ok: true,
        preview: {
          target_slug: target.slug,
          new_title: p[:new_title].presence || target.title,
          new_slug: p[:new_slug].presence || target.slug,
          first_page: first_page,
          last_page: last_page,
          nodes: merged_content.length,
          length_plain: plain_length(merged_doc)
        }
      }

      raise ActiveRecord::Rollback
    end

    # ------------------------------------------------------------------
    # 5. Save the final target values before touching indexes.
    # ------------------------------------------------------------------

    new_title = p[:new_title].presence || target.title
    new_slug  = p[:new_slug].presence || target.slug

    final_title = new_title
    final_slug  = slugify(new_slug)

    # ------------------------------------------------------------------
    # 6. Move ALL indexes into a safe temporary range.
    #
    # This completely eliminates the unique-index collision problem.
    # ------------------------------------------------------------------

    all_chapters = book.chapters.order(:index, :id).to_a

    temporary_base = -((all_chapters.map { |chapter| chapter.index.to_i.abs }.max || 0) + all_chapters.length + 1)

    all_chapters.each_with_index do |chapter, i|
      chapter.update_columns(
        index: temporary_base - i,
        updated_at: Time.current
      )
    end

    # ------------------------------------------------------------------
    # 7. Update target CONTENT while it is safely out of the way.
    # ------------------------------------------------------------------

    target.update_columns(
      title: final_title,
      slug: final_slug,
      tiptap_json: merged_doc,
      first_page: first_page,
      last_page: last_page,
      text_hash: Digest::SHA256.hexdigest(merged_doc.to_json),
      updated_at: Time.current
    )

    # ------------------------------------------------------------------
    # 8. Move highlights.
    # ------------------------------------------------------------------

    # For now there should be zero highlights, but keep the behavior.
    sources.each do |source|
      move_highlights!(
        from: source,
        to: target,
        add_offset: 0
      )
    end

    # ------------------------------------------------------------------
    # 9. Delete source chapters.
    # ------------------------------------------------------------------

    sources.each(&:destroy!)

    # ------------------------------------------------------------------
    # 10. Rebuild the indexes from the original ordering.
    #
    # The target takes the position of the first chapter being merged.
    # ------------------------------------------------------------------

    # Target is currently sitting at temporary_base + its old position.
    # Put surviving chapters back into their ORIGINAL relative order,
    # with the target occupying the first merged chapter's position.

    original_order = all_chapters.map(&:id)

    deleted_ids = sources.map(&:id)

    final_order = original_order
      .reject { |id| deleted_ids.include?(id) }
      .map { |id| id == target.id ? target.id : id }

    final_order.each_with_index do |chapter_id, i|
      book.chapters.find(chapter_id).update_columns(
        index: i + 1,
        updated_at: Time.current
      )
    end

    merge_result = {
      ok: true,
      target_slug: target.reload.slug,
      target_id: target.id,
      nodes: Array(target.reload.tiptap_json&.dig("content")).length
    }
  end
  render json: merge_result
rescue ActiveRecord::RecordNotUnique => e
  Rails.logger.error("Chapter merge uniqueness failure: #{e.message}")

  render json: {
    error: "Chapter merge failed because of a chapter index conflict.",
    detail: e.message
  }, status: :unprocessable_entity
rescue => e
  Rails.logger.error(
    "Chapter merge failed: #{e.class}: #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}"
  )

  render json: {
    error: e.message
  }, status: :unprocessable_entity
end

  # ==========================================================================
  # REORDER
  # ==========================================================================

  def reorder
    order = params.require(:order)

    unless order.is_a?(Array)
      raise ArgumentError, "order must be an array"
    end

    final_pairs = order.map do |row|
      slug = (row[:slug] || row["slug"]).to_s
      index = (row[:index] || row["index"]).to_i

      raise ArgumentError, "slug cannot be blank" if slug.blank?
      raise ArgumentError, "index must be >= 1" if index < 1

      [slug, index]
    end

    raise ArgumentError, "empty order" if final_pairs.empty?

    @book.with_lock do
      ActiveRecord::Base.transaction do
        chapters = @book.chapters.to_a
        chapters_by_slug = chapters.index_by(&:slug)

        missing =
          final_pairs
            .map(&:first)
            .uniq
            .reject { |slug| chapters_by_slug.key?(slug) }

        if missing.any?
          raise ActiveRecord::RecordNotFound,
            "missing chapters: #{missing.join(', ')}"
        end

        # Move EVERY chapter to a safe temporary negative index.
        chapters.each_with_index do |chapter, i|
          chapter.update_columns(
            index: -(i + 1),
            updated_at: Time.current
          )
        end

        # Apply requested order.
        final_pairs.each do |slug, index|
          chapters_by_slug.fetch(slug).update_columns(
            index: index,
            updated_at: Time.current
          )
        end
      end
    end

    head :no_content

  rescue => e
    render json: {
      error: e.message
    }, status: :unprocessable_entity
  end

  private

  # ==========================================================================
  # PARAMS
  # ==========================================================================

  def merge_params
    params.permit(
      :target_slug,
      :new_title,
      :new_slug,
      :preview,
      source_slugs: []
    )
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
      tiptap: {},
      tiptap_json: {}
    )
  end

  # ==========================================================================
  # BOOK / CHAPTER LOOKUP
  # ==========================================================================

  def set_book
    @book = Book.find_by!(slug: params[:book_slug])
  end

  def set_chapter
    @chapter = @book.chapters.find_by!(slug: params[:slug])
  end

  # ==========================================================================
  # SLUG
  # ==========================================================================

  def slugify(value)
    value
      .to_s
      .parameterize
      .presence || SecureRandom.hex(4)
  end

  # ==========================================================================
  # SAFE INDEX MANAGEMENT
  # ==========================================================================
  #
  # Because chapters have:
  #
  #   UNIQUE(book_id, index)
  #
  # we can never safely swap indexes directly.
  #
  # Phase 1:
  #
  #   1 -> -1
  #   2 -> -2
  #   3 -> -3
  #
  # Phase 2:
  #
  #   -1 -> 1
  #   -2 -> 2
  #   -3 -> 3
  #
  # PostgreSQL is therefore never asked to hold duplicate positive indexes.
  # ==========================================================================

  def renumber_all_to_temporary_indices!(book)
    chapters = book.chapters.order(:index, :id).to_a

    chapters.each_with_index do |chapter, i|
      chapter.update_columns(
        index: -(i + 1),
        updated_at: Time.current
      )
    end

    chapters
  end

def renumber!(book)
  chapters = book.chapters
                 .order(:index, :id)
                 .to_a

  return [] if chapters.empty?

  now = Time.current

  # --------------------------------------------------------------------------
  # Phase 1:
  #
  # Put EVERY chapter into a guaranteed unique temporary namespace.
  #
  # Using negative IDs means:
  #
  #   chapter id 220 -> index -220
  #   chapter id 221 -> index -221
  #
  # IDs are unique, therefore indexes are unique.
  #
  # This completely avoids collisions with the final positive indexes.
  # --------------------------------------------------------------------------

  chapters.each do |chapter|
    chapter.update_columns(
      index: -chapter.id,
      updated_at: now
    )
  end

  # --------------------------------------------------------------------------
  # Phase 2:
  #
  # Now assign the final contiguous indexes.
  #
  # There cannot be a collision because all remaining chapters currently
  # have negative indexes.
  # --------------------------------------------------------------------------

  chapters.each_with_index do |chapter, i|
    chapter.update_columns(
      index: i + 1,
      updated_at: now
    )
  end

  chapters
end

  # ==========================================================================
  # TIPTAP HELPERS
  # ==========================================================================

  def plain_length(doc)
    return 0 unless doc.is_a?(Hash)

    total = 0
    stack = Array(doc["content"])

    until stack.empty?
      node = stack.shift

      next unless node.is_a?(Hash)

      if node["type"] == "text"
        total += node["text"].to_s.length
      end

      children = node["content"]

      if children.is_a?(Array)
        stack.concat(children)
      end
    end

    total
  end

  def deep_dup_json(value)
    Marshal.load(Marshal.dump(value))
  end

  # ==========================================================================
  # HIGHLIGHTS
  # ==========================================================================

  def move_highlights!(from:, to:, add_offset:)
    return unless from.respond_to?(:user_highlights)
    return unless to.present?

    from.user_highlights.find_each do |highlight|
      selector =
        if highlight.selector.is_a?(Hash)
          deep_dup_json(highlight.selector)
        else
          JSON.parse(highlight.selector.to_s)
        end

      position =
        selector.dig("position")

      if position.is_a?(Hash) &&
         position["type"] == "TextPositionSelector"

        position["start"] =
          position["start"].to_i + add_offset

        position["end"] =
          position["end"].to_i + add_offset
      end

      to.user_highlights.create!(
        user_id: highlight.user_id,
        selector: selector,
        style: highlight.style,
        note: highlight.note
      )

      highlight.destroy!
    end
  end
end
