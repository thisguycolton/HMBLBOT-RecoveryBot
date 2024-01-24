class Book < ApplicationRecord
	has_many :pages
    has_many :chapters

    def self.ransackable_attributes(auth_object = nil)
    ["aa_approved", "author", "created_at", "id", "info", "org_approved", "pdf_url", "publicly_accessible", "published_date", "purchase_link", "title", "updated_at"]
    end

    def self.ransackable_associations(auth_object = nil)
    ["chapters", "pages"]
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
