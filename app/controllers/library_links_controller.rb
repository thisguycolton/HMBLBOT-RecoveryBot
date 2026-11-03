# /library/go?work=bigbook&chapter=we-agnostics or ?work=bigbook&page=63: a reading named in a
# step worksheet (readingLinks.js), found in the library by the book's work_key (stable across
# re-imports, unlike slugs) and opened at that chapter, or at that printed page. Anything it
# can't find goes to the book, or to the library.
class LibraryLinksController < ApplicationController
  def show
    # The English one first, then the newest edition
    book = Book.where(work_key: params[:work].to_s).select { |b| b.visible_to?(current_user) }
               .min_by { |b| [b.language == "en" ? 0 : 1, -b.edition.to_i] }
    return redirect_to("/library") unless book

    page = params[:page].to_i if params[:page].to_s.match?(/\A\d{1,4}\z/)
    chapter = find_chapter(book, params[:chapter].to_s, page)
    return redirect_to("/library/#{book.slug}") unless chapter

    exact = page && chapter.first_page && chapter.last_page && page.between?(chapter.first_page, chapter.last_page)
    redirect_to "/books/#{book.slug}/chapters/#{chapter.slug}#{"#page-#{page}" if exact}"
  end

  private

  def find_chapter(book, slug, page)
    chapters = book.chapters
    if slug.present?
      chapters.find_by(slug: slug) || chapters.find { |c| c.title.to_s.parameterize == slug }
    elsif page
      chapters.where("first_page <= ? AND last_page >= ?", page, page).order(:index).first ||
        # A page between chapters: the one before it
        (chapters.where("first_page <= ?", page).order(first_page: :desc).first if page <= chapters.maximum(:last_page).to_i)
    end
  end
end
