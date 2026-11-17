# JSON behind the Docs (DocsController, entrypoints/docs.jsx). Reading is public, limited to
# what this person may read (DocPage.readable_by); writing is for site admins
# (DocPage.editor?, which is User#suite_admin?).
class Api::DocsController < ApplicationController
  SEARCH_LIMIT = 20
  VIDEO_TYPES = %w[video/mp4 video/webm video/quicktime].freeze
  VIDEO_MAX = 300.megabytes

  before_action :require_editor!, except: %i[index show search]
  before_action :set_page, only: %i[update destroy versions version restore images videos]

  rescue_from ActiveRecord::RecordNotFound, with: -> { render json: { error: "Not found" }, status: :not_found }

  # GET /api/docs: every section with the pages this person may read, and the News block (featured
  # posts first, then the newest)
  def index
    pages = DocPage.readable_by(current_user).order(:position, :id).group_by(&:doc_section_id)
    editor = DocPage.editor?(current_user)
    sections = DocSection.ordered.filter_map do |s|
      list = pages[s.id] || []
      s.as_api_json(list) if list.any? || editor
    end
    json = { sections: sections, editor: editor, news: DocPage.news_feed(current_user).map(&:as_news_json) }
    json[:to_review] = DocPage.where(reviewed_at: nil).where.not(doc_section_id: DocSection.news.select(:id)).count if editor
    render json: json
  end

  # GET /api/docs/page?section=group-tools&page=group-chat | ?alias=about
  def show
    scope = DocPage.readable_by(current_user).includes(:section)
    page = if params[:alias].present?
             scope.find_by!(path_alias: params[:alias])
           else
             scope.joins(:section).find_by!(slug: params[:page], doc_sections: { slug: params[:section] })
           end
    order = if page.news?
              DocPage.newest_first(DocPage.readable_by(current_user).where(doc_section_id: page.doc_section_id).includes(:section).to_a)
            else
              DocPage.readable_by(current_user).ordered.includes(:section).to_a
            end
    at = order.index(page)
    neighbor = ->(p) { p && { title: p.title, path: p.path, section: p.section.title } }
    render json: {
      page: page.as_api_json(editor: DocPage.editor?(current_user)),
      previous: neighbor.call(at&.positive? ? order[at - 1] : nil),
      next: neighbor.call(at ? order[at + 1] : nil),
    }
  end

  # GET /api/docs/search?q=chips: title matches first, then summaries, then the text
  def search
    q = params[:q].to_s.squish
    return render(json: { query: q, results: [] }) if q.length < 2

    like = "%#{ActiveRecord::Base.sanitize_sql_like(q)}%"
    rank = DocPage.sanitize_sql_array(["CASE WHEN doc_pages.title ILIKE ? THEN 0 WHEN doc_pages.summary ILIKE ? THEN 1 ELSE 2 END", like, like])
    pages = DocPage.readable_by(current_user).includes(:section).joins(:section)
                   .where("doc_pages.title ILIKE :q OR doc_pages.summary ILIKE :q OR doc_pages.body ILIKE :q OR doc_sections.title ILIKE :q", q: like)
                   .order(Arel.sql(rank), "doc_sections.position", "doc_pages.position").limit(SEARCH_LIMIT)
    render json: {
      query: q,
      results: pages.map { |p| { title: p.title, path: p.path, section: p.section.title, icon: p.icon, summary: p.summary, snippet: p.snippet(q) } },
    }
  end

  # POST /api/docs/pages { page: { doc_section_id, title, ... } }
  def create
    section = DocSection.find(params.require(:page)[:doc_section_id])
    page = section.pages.new(page_params.except(:reviewed))
    page.position = (section.pages.maximum(:position) || 0) + 1 if page_params[:position].blank?
    page.status = page_params[:status].presence || "draft"
    if section.news?
      page.news_kind ||= "blog"
      # Posts are an editor's own words, not seeded draft text, so there's nothing to review
      page.reviewed_at = Time.current
      page.reviewed_by = current_user
      page.icon ||= "newspaper"
      page.body = "Write the post here. Type '/' for headings, lists and pictures.\n" if page.body.blank?
    end
    page.body = "## What it's for\n\n\n## How to use it\n\n1. \n" if page.body.blank?
    if page.save_edit({}, current_user)
      render json: { page: page.as_api_json(editor: true) }, status: :created
    else
      invalid(page)
    end
  end

  # PATCH /api/docs/pages/:id { page: { title, summary, body, icon, slug, status, audience,
  # position, doc_section_id, reviewed, and for news posts featured, news_kind, cover_image,
  # published_at } }
  def update
    attrs = page_params
    reviewed = attrs.delete(:reviewed)
    @page.mark_reviewed!(ActiveModel::Type::Boolean.new.cast(reviewed), current_user) unless reviewed.nil?
    if @page.save_edit(attrs, current_user)
      render json: { page: @page.as_api_json(editor: true) }
    else
      invalid(@page)
    end
  end

  def destroy
    @page.destroy!
    head :no_content
  end

  # GET /api/docs/pages/:id/versions
  def versions
    render json: { versions: @page.versions.includes(:saved_by).limit(100).map(&:as_api_json) }
  end

  # GET /api/docs/pages/:id/versions/:version_id
  def version
    render json: { version: @page.versions.find(params[:version_id]).as_api_json(full: true) }
  end

  # POST /api/docs/pages/:id/restore { version_id }
  def restore
    @page.restore!(@page.versions.find(params[:version_id]), current_user)
    render json: { page: @page.as_api_json(editor: true) }
  end

  # POST /api/docs/pages/:id/images (multipart: image) -> { url } for the Markdown
  def images
    file = params.require(:image)
    return render(json: { error: "That isn't a picture." }, status: :unprocessable_entity) unless file.respond_to?(:content_type) && file.content_type.to_s.start_with?("image/")
    return render(json: { error: "Pictures can be up to 10 MB." }, status: :unprocessable_entity) if file.size > 10.megabytes

    blob = ActiveStorage::Blob.create_and_upload!(io: file, filename: file.original_filename, content_type: file.content_type)
    @page.images.attach(blob)
    render json: { url: Rails.application.routes.url_helpers.rails_storage_proxy_path(blob, only_path: true) }, status: :created
  end

  # POST /api/docs/pages/:id/videos (multipart: video) -> { url } for a ```video block. The
  # editor sends it with XMLHttpRequest to show a progress bar (DocVideoUpload). Served from
  # this site (the storage proxy), like the pictures, so the reader never talks to S3 itself.
  def videos
    file = params.require(:video)
    return render(json: { error: "That isn't an MP4, WebM or MOV video." }, status: :unprocessable_entity) unless file.respond_to?(:content_type) && VIDEO_TYPES.include?(file.content_type.to_s)
    return render(json: { error: "Videos can be up to #{VIDEO_MAX / 1.megabyte} MB." }, status: :unprocessable_entity) if file.size > VIDEO_MAX

    blob = ActiveStorage::Blob.create_and_upload!(io: file, filename: file.original_filename, content_type: file.content_type)
    @page.videos.attach(blob)
    render json: { url: Rails.application.routes.url_helpers.rails_storage_proxy_path(blob, only_path: true) }, status: :created
  end

  # POST/PATCH/DELETE /api/docs/sections
  def create_section
    section = DocSection.new(section_params)
    section.position = (DocSection.maximum(:position) || 0) + 1 if section_params[:position].blank?
    section.save ? render(json: { section: section.as_api_json([]) }, status: :created) : invalid(section)
  end

  def update_section
    section = DocSection.find(params[:id])
    section.update(section_params) ? render(json: { section: section.as_api_json(section.pages) }) : invalid(section)
  end

  def destroy_section
    section = DocSection.find(params[:id])
    return render(json: { error: "Move or delete its pages first." }, status: :unprocessable_entity) if section.pages.exists?

    section.destroy!
    head :no_content
  end

  private

  def require_editor!
    render json: { error: "Only site admins can edit the docs." }, status: :forbidden unless DocPage.editor?(current_user)
  end

  def set_page = @page = DocPage.find(params[:id])

  def page_params
    params.require(:page).permit(:doc_section_id, :title, :summary, :body, :icon, :slug, :status, :audience, :position, :reviewed,
                                 :featured, :news_kind, :cover_image, :published_at).to_h.symbolize_keys
  end

  def section_params = params.require(:section).permit(:title, :summary, :icon, :slug, :position)

  def invalid(record)
    render json: { error: record.errors.full_messages.to_sentence, errors: record.errors.full_messages }, status: :unprocessable_entity
  end
end
