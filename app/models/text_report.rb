# A reader's report that some text in a chapter is wrong (an OCR slip, a missing
# word, a bad heading). Made from a text selection, like a highlight; admins
# review them in the admin suite, comment, and resolve them.
class TextReport < ApplicationRecord
  STATUSES = %w[open resolved].freeze

  belongs_to :user
  belongs_to :chapter
  belongs_to :resolved_by, class_name: "User", optional: true
  has_many :comments, -> { order(:created_at) }, class_name: "TextReportComment", dependent: :destroy

  validates :message, presence: true, length: { maximum: 5_000 }
  validates :status, inclusion: { in: STATUSES }
  validate :selector_has_quote

  after_create_commit :notify_admins

  scope :unresolved, -> { where(status: "open") }
  scope :resolved, -> { where(status: "resolved") }

  def quote
    selector.dig("quote", "exact").to_s
  end

  def resolve!(by)
    update!(status: "resolved", resolved_at: Time.current, resolved_by: by)
    Notification.deliver(user, kind: "text_report.resolved", title: "Your report on #{place} was resolved",
                               body: "“#{quote.truncate(120)}”", url: reader_path)
  end

  # "Daily Reflections · January 10: United We Stand"
  def place
    "#{chapter.book.title} · #{chapter.title}"
  end

  def reader_path
    "/books/#{chapter.book.slug}/chapters/#{chapter.slug}"
  end

  def reopen!
    update!(status: "open", resolved_at: nil, resolved_by: nil)
  end

  private

  def notify_admins
    Notification.deliver(User.suite_admins - [user], kind: "text_report.created",
                         title: "New text report on #{place}", body: message, url: "/admin_panel/text_reports")
  end

  def selector_has_quote
    errors.add(:selector, "must include the selected text") if quote.strip.empty?
  end
end
