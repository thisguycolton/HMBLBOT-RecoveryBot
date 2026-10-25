# The search box at the top of every page (components/shell/SearchBox.jsx): a few of each kind
# of thing whose name holds what was typed. Groups, readings from the archive, and the library's
# chapters and books; people too, for members. (Hashtags come from their own endpoint.)
class Api::SearchController < ApplicationController
  EACH = 5

  # GET /api/search?q=grat
  def index
    q = params[:q].to_s.squish
    return render(json: { query: q, sections: [] }) if q.length < 2

    like = "%#{ActiveRecord::Base.sanitize_sql_like(q.delete_prefix("#"))}%"
    sections = []
    sections << { key: "groups", items: groups(like) }
    sections << { key: "people", items: people(like) } if User.profiles_open_to?(current_user)
    sections << { key: "readings", items: readings(like) }
    sections << { key: "literature", items: chapters(like) + books(like) }
    render json: { query: q, sections: sections.select { |s| s[:items].any? } }
  end

  private

  def groups(like)
    Group.where(status: "active").where("title ILIKE :q OR location ILIKE :q", q: like).order(:title).limit(EACH)
         .map do |g|
           { title: g.title, subtitle: [g.location.presence, "#{g.members.count} #{"member".pluralize(g.members.count)}"].compact.join(" · "),
             url: "/groups/#{g.slug}" }
         end
  end

  def people(like)
    User.where("name ILIKE :q OR username ILIKE :q", q: like).where.not(username: nil).includes(avatar_attachment: :blob)
        .order(:name).limit(EACH).map { |u| { title: u.display_name, subtitle: "@#{u.username}", url: u.profile_path, avatar_url: u.avatar_url } }
  end

  def readings(like)
    Reading.published.where("readings.title ILIKE :q OR readings.source ILIKE :q", q: like).order(published_at: :desc).limit(EACH)
           .map { |r| { title: r.title.presence || "Untitled reading", subtitle: [r.source, r.host].compact_blank.join(" | "), url: "/readings/#{r.id}" } }
  end

  def chapters(like)
    Chapter.joins(:book).merge(Book.visible_to(current_user)).where("chapters.title ILIKE :q OR chapters.label ILIKE :q", q: like)
           .includes(:book).order("books.title", :index).limit(EACH)
           .map do |c|
             { title: c.title, subtitle: [c.book.title, ("p. #{c.first_page}" if c.first_page)].compact.join(" · "),
               url: "/books/#{c.book.slug}/chapters/#{c.slug}", kind: "Chapter" }
           end
  end

  def books(like)
    Book.visible_to(current_user).where("title ILIKE :q OR author ILIKE :q", q: like).order(:title).limit(3)
        .map { |b| { title: b.title, subtitle: b.author.presence || "Book", url: "/library/#{b.slug}", kind: "Book" } }
  end
end
