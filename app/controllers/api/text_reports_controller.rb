# Readers report a problem with some text from the reader's selection menu.
# Admins review the reports in the admin suite (Api::Admin::TextReportsController).
class Api::TextReportsController < ApplicationController
  before_action :authenticate_user!

  # POST /api/text_reports
  # { text_report: { chapter_slug, book_slug, message, selector: { position, quote } } }
  def create
    attrs = params.require(:text_report).permit(:chapter_slug, :book_slug, :message, selector: {})
    chapters = Chapter.where(slug: attrs[:chapter_slug])
    chapters = chapters.joins(:book).where(books: { slug: attrs[:book_slug] }) if attrs[:book_slug].present?

    report = current_user.text_reports.create!(
      chapter: chapters.first!,
      message: attrs[:message].to_s.strip,
      selector: attrs[:selector].to_h
    )
    render json: { id: report.id }, status: :created
  rescue ActiveRecord::RecordNotFound
    render json: { error: "That chapter isn't in the library." }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end
end
