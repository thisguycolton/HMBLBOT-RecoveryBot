# app/services/literature_importer.rb

class LiteratureImporter
  require "json"
  require "digest"
  require "pathname"



  # These are the 57 sections we expect to import, in order.
  #
  # Duplicate titles such as "A.A." are intentional.
  EXPECTED_HEADINGS = [
    "THIS IS A.A.",
    "WE, OF ALCOHOLICS ANONYMOUS",
    "FOREWORD TO SECOND EDITION",
    "FOREWORD TO THIRD EDITION",
    "FOREWORD TO FOURTH EDITION",
    "THE DOCTORS OPINION",

    "BILL'S STORY",
    "THERE IS A SOLUTION",
    "MORE ABOUT ALCOHOLISM",
    "WE AGNOSTICS",
    "HOW IT WORKS",
    "INTO ACTION",
    "WORKING WITH OTHERS",
    "TO WIVES*",
    "THE FAMILY AFTERWARD",
    "TO EMPLOYERS",
    "A VISION FOR YOU",

    "DOCTOR BOB'S NIGHTMARE",
    "ALCOHOLIC ANONYMOUS NUMBER THREE",
    "GRATITUDE IN ACTION",
    "WOMEN SUFFER TOO",
    "OUR SOUTHERN FRIEND",
    "THE VICIOUS CYCLE",
    "JIM'S STORY",
    "THE MAN WHO MASTERED FEAR",
    "HE SOLD HIMSELF SHORT",
    "THE KEYS OF THE KINGDOM",
    "A.A.",
    "THE MISSING LINK",
    "FEAR OF FEAR",
    "THE HOUSEWIFE WHO DRANK AT HOME",
    "PHYSICIAN, HEAL THYSELF!",
    "MY CHANCE TO LIVE",
    "STUDENT OF LIFE",
    "CROSSING THE RIVER OF DENIAL",
    "BECAUSE I'M AN ALCOHOLIC",
    "A.A.",
    "IT MIGHT HAVE BEEN WORSE",
    "TIGHTROPE",
    "FLOODED WITH FEELING",
    "WINNER TAKES ALL",
    "ME AN ALCOHOLIC?",
    "THE PERPETUAL QUEST",
    "A DRUNK, LIKE YOU",
    "ACCEPTANCE WAS THE ANSWER",
    "WINDOW OF OPPORTUNITY",
    "MY BOTTLE, MY RESENTMENTS, AND ME",
    "HE LIVED ONLY TO DRINK",
    "SAFE HAVEN",
    "LISTENING TO THE WIND",
    "TWICE GIFTED",
    "BUILDING A NEW LIFE",
    "ON THE MOVE",
    "A.A.,",
    "A VISION OF RECOVERY",
    "GUTTER BRAVADO",
    "EMPTY ON THE INSIDE",
    "GROUNDED",
    "ANOTHER CHANCE",
    "A LATE START",
    "FREEDOM FROM BONDAGE",
    "A.A.",
    "A.A. TAUGHT HIM TO HANDLE SOBRIETY"
  ].freeze

  EXPECTED_SECTION_COUNT = EXPECTED_HEADINGS.length

  def self.import!(
    book_slug:,
    file: nil,
    data: nil,
    title: "Alcoholics Anonymous",
    work_key: "bigbook",
    edition: "4e",
    language: "en",
    replace: false,
    dry_run: false
  )
    new(
      book_slug: book_slug,
      file: file,
      data: data,
      title: title,
      work_key: work_key,
      edition: edition,
      language: language,
      replace: replace,
      dry_run: dry_run
    ).import!
  end

  def initialize(
    book_slug:,
    file: nil,
    data: nil,
    title:,
    work_key:,
    edition:,
    language:,
    replace:,
    dry_run:
  )
    @book_slug = book_slug
    @file = Pathname(file) if file.present?
    @title = title
    @work_key = work_key
    @edition = edition
    @language = language
    @replace = replace
    @dry_run = dry_run

    raise ArgumentError, "Provide a source file or parsed JSON data" if @file.nil? && data.nil?
    raise ArgumentError, "File not found: #{@file}" if @file && !@file.exist?

    @data = data || JSON.parse(@file.read)
  end

  def import!
    pages = @data.fetch("document").fetch("pages")

    sections = discover_sections(pages)

    pages = pages.take_while do |page|
      !Array(page["headings"]).any? do |heading|
        normalize_for_compare(heading) == "APPENDICES"
      end
    end

    print_report(sections)
    validate_sections!(sections)

    return true if @dry_run

    ActiveRecord::Base.transaction do
      book = find_or_initialize_book!

      # Run chapter callbacks so dependent highlights are removed as well.
      book.chapters.destroy_all if @replace

      sections.each do |section|
        chapter = Chapter.find_or_initialize_by(
          book_id: book.id,
          index: section[:index]
        )

        chapter.assign_attributes(
          title: section[:title],
          number: section[:number],
          slug: section[:slug],
          first_page: section[:first_page],
          last_page: section[:last_page],
          tiptap_json: section[:tiptap_json],
          text_hash: section[:text_hash],
          kind: section[:kind],
          label: section[:label]
        )

        chapter.save!
      end

    end

    puts
    puts "IMPORT COMPLETE"
    puts "Imported #{sections.length} sections."

    true
  end

  private

  # ==========================================================================
  # SECTION DISCOVERY
  # ==========================================================================

  def discover_sections(pages)

    pages = pages.take_while do |page|
      !Array(page["headings"]).any? do |heading|
        normalize_for_compare(heading) == "APPENDICES"
      end
    end

    starts = []

    pages.each do |page|
      heading = section_heading_for(page)

      next if heading.nil?

      starts << {
        title: normalize_heading_text(heading),
        pdf_page: page.fetch("pdf_page"),
        printed_page: page["printed_page"]
      }
    end

    # Remove duplicate detection of the same heading on the same PDF page.
    starts = starts.each_with_object([]) do |entry, result|
      previous = result.last

      if previous &&
         previous[:pdf_page] == entry[:pdf_page] &&
         normalize_for_compare(previous[:title]) ==
           normalize_for_compare(entry[:title])

        next
      end

      result << entry
    end

    starts.each_with_index.map do |start, index|
      finish = starts[index + 1]

      section_pages = pages.select do |page|
        pdf_page = page.fetch("pdf_page")

        pdf_page >= start[:pdf_page] &&
          (finish.nil? || pdf_page < finish[:pdf_page])
      end

      build_section(
        index: index + 1,
        title: start[:title],
        pages: section_pages
      )
    end
  end

  # ==========================================================================
  # HEADING DETECTION
  # ==========================================================================

def section_heading_for(page)
  # PDF page 581 is the back matter/footer page. Its "A.A." heading
  # is not a real section heading.
  return nil if page["pdf_page"].to_i == 581

  headings = Array(page["headings"])

  headings.each do |raw_heading|
    heading = normalize_heading_text(raw_heading.to_s)

    next if heading.empty?

    # The PDF extractor truncates these two headings because of layout.
    return "THIS IS A.A." if heading == "THIS IS"
    return "WE, OF ALCOHOLICS ANONYMOUS" if heading == "WE, OF"

    expected = EXPECTED_HEADINGS.find do |candidate|
      normalize_for_compare(candidate) ==
        normalize_for_compare(heading)
    end

    return expected if expected
  end

  nil
end

  # ==========================================================================
  # NORMALIZATION
  # ==========================================================================

  def normalize_heading_text(text)
    text
      .unicode_normalize(:nfkc)
      .tr("’‘", "''")
      .strip
      .gsub(/\s+/, " ")
  end

  def normalize_for_compare(text)
    normalize_heading_text(text).upcase
  end

  # ==========================================================================
  # SECTION
  # ==========================================================================

  def build_section(index:, title:, pages:)
    raise "No pages found for #{title}" if pages.empty?

    tiptap = build_tiptap(
      title: title,
      chapter_number: chapter_number_for(index),
      pages: pages
    )

    {
      index: index,
      number: chapter_number_for(index),
      title: title,
      label: title,
      slug: slug_for(index, title),
      kind: kind_for(index),
      first_page: pages.first["printed_page"],
      last_page: pages.last["printed_page"],
      tiptap_json: tiptap,
      text_hash: Digest::SHA256.hexdigest(tiptap.to_json)
    }
  end

  def chapter_number_for(index)
    # The first six sections are front matter:
    #
    # 1  This Is A.A.
    # 2  We, of Alcoholics Anonymous
    # 3  Foreword to Second Edition
    # 4  Foreword to Third Edition
    # 5  Foreword to Fourth Edition
    # 6  The Doctor's Opinion
    #
    # Bill's Story is Chapter 1.
    return nil if index <= 6

    index - 6
  end

  def kind_for(index)
    index <= 6 ? "foreword" : "chapter"
  end

  def slug_for(index, title)
    prefix = index <= 6 ? "foreword" : "chapter"

    slug_title =
      title
        .downcase
        .gsub(/[^a-z0-9]+/, "-")
        .gsub(/\A-+|-+\z/, "")

    "#{prefix}-#{index}-#{slug_title}"
  end

  # ==========================================================================
  # TIPTAP
  # ==========================================================================

  def build_tiptap(title:, chapter_number:, pages:)
    nodes = []

    if chapter_number
      nodes << heading_node(
        "Chapter #{chapter_number}",
        italic: true,
        centered: true
      )
    end

    nodes << heading_node(
      title,
      bold: true,
      centered: true
    )

    pages.each_with_index do |page, page_index|
      append_page!(
        nodes,
        page,
        final_page: page_index == pages.length - 1,
        next_page: pages[page_index + 1]&.fetch("printed_page", nil),
        section_title: title
      )
    end

    {
      "type" => "doc",
      "content" => nodes
    }
  end

  def append_page!(nodes, page, final_page:, next_page:, section_title:)
    blocks = Array(page["blocks"])

    i = 0

    while i < blocks.length
      block = blocks[i]
      type = block["type"].to_s

      case type

      when "heading"
        text = block["text"].to_s.strip

        unless text.empty? ||
               normalize_for_compare(text) ==
                 normalize_for_compare(section_title) ||
               text.match?(/\AChapter\s+\d+\z/i)

          nodes << heading_node(
            text,
            bold: true,
            centered: true
          )
        end

      when "paragraph"
        if drop_cap_block?(block) &&
           blocks[i + 1].is_a?(Hash) &&
           blocks[i + 1]["type"].to_s == "paragraph"

          next_block = blocks[i + 1]

          text =
            block["text"].to_s +
            next_block["text"].to_s

          nodes << paragraph_node(
            text,
            page["printed_page"]
          )

          i += 1

        elsif drop_cap_block?(block)
          # Decorative drop cap with no following paragraph.
          # Do not expose it as standalone text.

        else
          text = block["text"].to_s

          nodes << paragraph_node(
            text,
            page["printed_page"]
          ) unless text.strip.empty?
        end

      when "page_number"
        # Usually this is only a running head and printed page number.  On some
        # pages, however, the extractor groups the first body lines into this
        # block as well. Keep those lines (below the header area) so a page does
        # not lose its opening sentence/paragraph.
        text = page_number_continuation_text(block)
        nodes << paragraph_node(text, page["printed_page"]) unless text.blank?

      else
        text = block["text"].to_s

        nodes << paragraph_node(
          text,
          page["printed_page"]
        ) unless text.strip.empty?
      end

      i += 1
    end

    # This node is rendered *before* the next page's text, so it must carry the
    # next printed-page number. Using the current page made every page label
    # point one page ahead in the reader.
    unless final_page
      nodes << {
        "type" => "pageBreak",
        "attrs" => {
          "page" => next_page
        }
      }
    end
  end

  # ==========================================================================
  # DROP CAPS
  # ==========================================================================

  def drop_cap_block?(block)
    return false unless block["type"].to_s == "paragraph"

    text = block["text"].to_s.strip

    return false unless text.length == 1
    return false unless text.match?(/\A[A-Za-z]\z/)

    lines = Array(block["lines"])

    lines.any? do |line|
      line["font"].to_s == "ParkAvenue" ||
        line["font_size"].to_f >= 30
    end
  end

  def page_number_continuation_text(block)
    Array(block["lines"])
      .select { |line| Array(line["bbox"])[1].to_f >= 54 }
      .map { |line| line["text"].to_s.strip }
      .reject(&:empty?)
      .join(" ")
  end

  # ==========================================================================
  # TIPTAP NODES
  # ==========================================================================

  def paragraph_node(text, page)
    attrs = {}

    attrs["page"] = page unless page.nil?

    {
      "type" => "paragraph",
      "attrs" => attrs,
      "content" => [
        {
          "type" => "text",
          "text" => text
        }
      ]
    }
  end

  def heading_node(text, bold: false, italic: false, centered: false)
    marks = []

    marks << { "type" => "bold" } if bold
    marks << { "type" => "italic" } if italic

    content = {
      "type" => "text",
      "text" => text
    }

    content["marks"] = marks unless marks.empty?

    {
      "type" => "heading",
      "attrs" => {
        "level" => 2,
        "textAlign" => centered ? "center" : nil
      },
      "content" => [content]
    }
  end

  # ==========================================================================
  # VALIDATION
  # ==========================================================================

  def validate_sections!(sections)
    puts

    actual_count = sections.length

    if actual_count != EXPECTED_SECTION_COUNT
      puts "SECTION COUNT FAILED"
      puts
      puts "Expected: #{EXPECTED_SECTION_COUNT}"
      puts "Found:    #{actual_count}"
      puts
    end

    expected = EXPECTED_HEADINGS.map do |heading|
      normalize_for_compare(heading)
    end

    actual = sections.map do |section|
      normalize_for_compare(section[:title])
    end

    max = [expected.length, actual.length].max
    mismatches = []

    max.times do |i|
      expected_title = expected[i]
      actual_title = actual[i]

      next if expected_title == actual_title

      mismatches << {
        index: i + 1,
        expected: expected_title,
        actual: actual_title
      }
    end

    if mismatches.empty? && actual_count == EXPECTED_SECTION_COUNT
      puts "SECTION VALIDATION PASSED"
      puts
      puts "All #{EXPECTED_SECTION_COUNT} sections match the expected"
      puts "headings in the expected order."
      puts
      puts "=" * 100
      return
    end

    puts "SECTION VALIDATION FAILED"
    puts

    mismatches.each do |mismatch|
      puts format(
        "%02d  EXPECTED: %-55s  FOUND: %s",
        mismatch[:index],
        mismatch[:expected],
        mismatch[:actual] || "MISSING"
      )
    end

    puts
    puts "=" * 100

    raise <<~ERROR
      Section validation failed.

      Expected #{EXPECTED_SECTION_COUNT} sections in the canonical order.
      Found #{actual_count} sections.

      The importer will not modify the database until the repaired
      source matches the expected section structure.
    ERROR
  end

  # ==========================================================================
  # BOOK
  # ==========================================================================

def find_or_initialize_book!
  # An import initiated from /books/:slug/chapters must update that exact book.
  # The work/edition tuple remains a fallback for command-line imports.
  book = Book.find_by(slug: @book_slug) || Book.find_or_initialize_by(
    work_key: @work_key,
    edition: @edition,
    language: @language
  )

  if book.new_record?
    book.slug = @book_slug
    book.title = @title
    book.work_key = @work_key
    book.edition = @edition
    book.language = @language
  else
    book.slug = @book_slug
    book.title = @title
  end

  book.save!

  book
end

  # ==========================================================================
  # REPORT
  # ==========================================================================

  def print_report(sections)
    puts
    puts "=" * 100
    puts "LITERATURE IMPORT DRY RUN"
    puts "=" * 100
    puts
    puts "Source: #{@file || "uploaded JSON"}"
    puts "PDF pages: #{@data.fetch("document").fetch("pages").length}"
    puts "Sections found: #{sections.length}"
    puts "Expected: #{EXPECTED_SECTION_COUNT}"
    puts

    sections.each do |section|
      puts format(
        "%02d  %-55s  printed %s-%s  %s",
        section[:index],
        section[:title].to_s[0, 55],
        section[:first_page] || "?",
        section[:last_page] || "?",
        section[:kind]
      )
    end

    puts
    puts "=" * 100
  end
end
