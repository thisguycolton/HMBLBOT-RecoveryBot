class Book < ApplicationRecord
  # Writebook's cover colors (BookCover.jsx draws them). No color picks one from the slug.
  COVER_COLORS = %w[black blue green magenta orange violet white].freeze

  has_many :chapters, dependent: :destroy
  has_many :pages, dependent: :delete_all
  has_one_attached :cover_image
  validates :slug, presence: true, uniqueness: true
  validates :cover_color, inclusion: { in: COVER_COLORS }, allow_nil: true

  # Books are public unless "Everyone" is switched off on the edit page; then only admins see them.
  scope :visible_to, ->(user) { user&.admin? ? all : where(publicly_accessible: [true, nil]) }

  def public?
    publicly_accessible != false
  end

  def visible_to?(user)
    public? || user&.admin?
  end

  # An uploaded cover wins over a pasted image URL.
  def cover_url
    return Rails.application.routes.url_helpers.rails_blob_path(cover_image, only_path: true) if cover_image.attached?

    image_url.presence
  end

    def self.ransackable_attributes(auth_object = nil)
    ["aa_approved", "author", "created_at", "id", "info", "org_approved", "pdf_url", "publicly_accessible", "published_date", "purchase_link", "title", "updated_at"]
    end

    def self.ransackable_associations(auth_object = nil)
    ["chapters", "pages"]
    end

  # Chapters matching `query`, in reading order, each with its match count and
  # the first few snippets.
  def search(query, snippets: 3)
    chapters.ordered.filter_map do |chapter|
      matches = chapter.search(query)
      next if matches.empty?

      {
        slug: chapter.slug,
        title: chapter.title,
        first_page: chapter.first_page,
        count: matches.size,
        snippets: matches.first(snippets)
      }
    end
  end

	# validates :pdf_url, presence: true

	#   after_create :extract_and_save_pages_from_pdf

  private

  # def extract_and_save_pages_from_pdf
  #   pdf_url = self.pdf_url # Replace this with your attribute containing the PDF URL

  #   PageExtractor.extract_and_save_pages(self.id, pdf_url)
  # rescue StandardError => e
  #   Rails.logger.error "Extraction failed for book #{self.id}: #{e.message}"
  # end
# require 'open-uri'
# require 'pdf/reader'

# def self.pdf(pdf_url)
# 	pdf_content = URI.open(pdf_url)
#   	reader = PDF::Reader.new(pdf_content)
# end

#   def self.extract_text_from_specific_page(pdf_url, page_number)
#     page_number = page_number.to_i

#     text_from_page = ''

#     pdf_content = URI.open(pdf_url)
#     reader = PDF::Reader.new(pdf_content)

#     reader.pages.each_with_index do |page, index|
#       if (index - 10) == page_number
#         text_from_page = page.text.gsub('\n', "\n")
#         break
#       end
#     end

#     text_from_page
#   end

# def self.extract_text_with_page_numbers_from_url(pdf_url)
#   page_number_regex = /\b\d+\b/ # Regular expression to match page numbers

#   text_with_page_numbers = {}

#   pdf_content = URI.open(pdf_url)
#   reader = PDF::Reader.new(pdf_content)

#   reader.pages.each_with_index do |page, index|
#     text = page.text
#     page_number = text.scan(page_number_regex).join.to_i

#     # Remove the page number from the text content
#     text_without_page_number = text.gsub(page_number_regex, '')

#     text_with_page_numbers[index + 1] = {
#       content: text_without_page_number.strip,
#       page_number: page_number
#     }
#   end

#   text_with_page_numbers
# end
# pdf_url = "https://acid-test.s3.us-west-2.amazonaws.com/books/AA-BigBook-4th-Edition.pdf"

# 	# https://acid-test.s3.us-west-2.amazonaws.com/books/AA-BigBook-4th-Edition.pdf
end
