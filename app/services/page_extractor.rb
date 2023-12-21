# app/services/page_extractor.rb
require 'open-uri'
require 'pdf/reader'

class PageExtractor
  def self.extract_and_save_pages(book_id, pdf_url)
    pdf_content = URI.open(pdf_url)
    reader = PDF::Reader.new(pdf_content)

    Book.transaction do
      book = Book.find(book_id)

      reader.pages.each_with_index do |page, index|
        book.pages.create(content: page.text.gsub(/(\b\w+)-\s+(\w+\b)/, '\1\2'), page_number: (index + 1).to_s)
      end
    end
  end
end
