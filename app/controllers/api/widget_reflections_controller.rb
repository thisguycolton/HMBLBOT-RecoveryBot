# The Daily Reflection widget in the iPhone and Android apps (lib/appWidgets.js hands it over):
# each day's reading from today on, so the widget turns over at midnight without the app being
# opened. Only what the widget shows: the title, the opening quote, where it's from and how
# long the whole reading takes; tapping the widget opens the page itself.
class Api::WidgetReflectionsController < ApplicationController
  before_action :authenticate_user!

  DAYS = 14

  # GET /api/widget_reflections?from=YYYY-MM-DD
  def show
    book = Book.find_by(slug: DailyStory::BOOK)
    return render(json: { reflections: [] }) if book.nil? || !book.visible_to?(current_user) || book.locked_for?(current_user)

    from = begin
      Date.iso8601(params[:from].to_s)
    rescue ArgumentError
      Date.current
    end
    days = (0...DAYS).map { |i| from + i }
    slugs = days.to_h { |d| ["#{Date::MONTHNAMES[d.month].downcase}-#{d.day}", d] }
    chapters = book.chapters.where(slug: slugs.keys).index_by(&:slug)
    reflections = slugs.filter_map do |slug, day|
      chapter = chapters[slug]
      next unless chapter

      WidgetReflection.of(chapter).merge(date: day.iso8601, path: "/books/#{book.slug}/chapters/#{chapter.slug}")
    end
    render json: { reflections: reflections }
  end
end
