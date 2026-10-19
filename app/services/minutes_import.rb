require "zip"

# Brings a group's old business-meeting minutes in from a folder of Word files (one per meeting,
# in folders by year, the way The Acid Test kept them): a BusinessMeeting per meeting with the
# minutes as its record, and a Motion for each motion the minutes mention. Old minutes were
# written freely, so everything lands for record keepers to check first: the meetings are
# visible to keepers only and the motions are marked needs_review until a keeper saves them.
# Phone numbers and email addresses are taken out of the minutes on the way in.
#
#   MinutesImport.new(group, "/path/to/Minutes", user: someone).run(dry_run: true)
class MinutesImport
  MONTHS = Date::MONTHNAMES.compact.each_with_index.flat_map { |m, i| [[m.downcase, i + 1], [m[0, 3].downcase, i + 1]] }.to_h.merge("sept" => 9)
  PHONE = /\(?\b\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/
  EMAIL = /\b[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+\b/
  # Approving the minutes, a report or the agenda, or closing: kept in the minutes, not the log
  ROUTINE = /\b(?:motion(?:ed)?|moved)\b[^.;]{0,40}?\b(?:to\s+)?(?:accept|approve|close|adjourn)\b(?!\s+(?:the\s+)?(?:new|changes?|wording|exemption))|\bMOTION:\s*accept\b/i
  NAME = /([A-Z][a-z]+(?:\s[A-Z]\.?)?)/

  Entry = Struct.new(:path, :held_on, :paragraphs, :skipped, keyword_init: true)

  def initialize(group, folder, user: nil)
    @group = group
    @folder = folder
    @user = user
  end

  # Which files make which meetings, and what was left out and why, without saving anything
  def plan
    entries = files.map { |path| entry(path) }
    kept = {}
    entries.each do |e|
      next if e.skipped

      if (other = kept[e.held_on])
        # The same meeting twice ("Copy of", "(1)", an amended version): keep the longer one
        loser, winner = [other, e].sort_by { |x| x.paragraphs.sum { |p| p[:text].size } }
        loser.skipped = "same meeting as #{File.basename(winner.path)}"
        kept[e.held_on] = winner
      else
        kept[e.held_on] = e
      end
    end
    entries.sort_by { |e| [e.held_on || Date.new(1900), e.path] }
  end

  # Saves (unless dry_run) and returns one row per file: what it became
  def run(dry_run: false)
    seen = Set.new
    plan.map do |e|
      next { file: rel(e.path), skipped: e.skipped } if e.skipped

      # Minutes often carry last month's motions forward word for word; the first one counts
      motions = motions_in(e.paragraphs).select { |m| seen.add?([m[:title].downcase, m[:status]]) }
      unless dry_run
        BusinessMeeting.transaction do
          bm = @group.business_meetings.find_or_initialize_by(held_on: e.held_on)
          next if bm.persisted? && bm.motions.exists? # already brought in

          bm.assign_attributes(status: "held", minutes: html(e.paragraphs), minutes_status: "approved", visibility: "keepers", created_by: bm.created_by || @user)
          bm.save!
          motions.each do |m|
            @group.motions.create!(m.merge(business_meeting: bm, decided_on: e.held_on, kind: "main", needs_review: true, visibility: "members", created_by: @user))
          end
        end
      end
      { file: rel(e.path), held_on: e.held_on, motions: motions }
    end
  end

  # The motions in a meeting's paragraphs. A motion's outcome is often its own line after it
  # ("Motion passed"), so a line that's only an outcome settles the motion before it.
  def motions_in(paragraphs)
    found = []
    paragraphs.each do |para|
      line = para[:text]
      next unless line =~ /\bmotion|\bmoved\b/i

      if outcome_only?(line)
        found.last[:status] ||= status_of(line) if found.last && found.last[:open]
        next
      end
      found.last&.delete(:open)
      next if line =~ ROUTINE || line =~ /discussed in (?:the\s+)?motion|\Amotion\s+(?:made\s+)?by\s+\w+(?:,\s*\w+)?\.?\z/i
      next if title_of(line).split.size < 3

      found << { title: title_of(line), text: line, status: status_of(line), moved_by_name: mover(line), seconded_by_name: seconder(line), category: category_of(line), open: true }
    end
    found.each { |m| m.delete(:open); m[:status] ||= "proposed" }
  end

  def status_of(line)
    case line
    when /did\s*n[o']t\s+pass|\bfail(ed|s)?\b|\bdenied\b|not\s+approved|\bdefeated\b|\bvoted\s+down\b/i then "failed"
    when /\bno\s+second\b/i then "no_second"
    when /\bwithdr[ae]wn?\b/i then "withdrawn"
    when /\btabled?\b/i then "tabled"
    when /\b(passed|carried|approved|accepted|adopted)\b/i then "passed"
    end
  end

  private

  def files = Dir.glob(File.join(@folder, "**", "*.{docx,DOCX}")).sort

  def rel(path) = path.delete_prefix("#{@folder}/")

  def entry(path)
    name = File.basename(path, ".*").squish
    return Entry.new(path: path, skipped: "agenda") if name =~ /agenda/i
    return Entry.new(path: path, skipped: "not in a year folder") unless File.basename(File.dirname(path)) =~ /\A(19|20)\d\d\z/

    held_on = date_from(name, File.basename(File.dirname(path)).to_i)
    return Entry.new(path: path, skipped: "no date in the file name") unless held_on

    Entry.new(path: path, held_on: held_on, paragraphs: paragraphs(path))
  rescue Zip::Error => e
    Entry.new(path: path, skipped: "couldn't read it (#{e.message})")
  end

  # "Acid Test Minutes 03-22-2020", "bus meeting mins 2023-4-16", "GC April MINUTES-2025",
  # "February GC MINUTES" (the year from its folder). With only a month, the third Sunday,
  # when the group held them.
  def date_from(name, folder_year)
    if (m = name.match(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/))
      return Date.new(m[3].to_i, m[1].to_i, m[2].to_i)
    end
    if (m = name.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))
      return Date.new(m[1].to_i, m[2].to_i, m[3].to_i)
    end

    month = name.downcase.scan(/[a-z]+/).filter_map { |w| MONTHS[w] }.first
    return unless month

    year = name[/\b(20\d\d)\b/, 1]&.to_i || folder_year
    first = Date.new(year, month, 1)
    first + ((7 - first.wday) % 7) + 14
  rescue Date::Error
    nil
  end

  # The document's paragraphs, in order, with whether each is a list item
  def paragraphs(path)
    xml = Zip::File.open(path) { |zip| zip.read("word/document.xml") }
    doc = Nokogiri::XML(xml)
    doc.xpath("//w:body//w:p", "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main").filter_map do |p|
      text = p.xpath(".//w:t|.//w:tab", "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main").map { |n| n.name == "tab" ? " " : n.text }.join
      text = scrub(text).squish
      next if text.empty?

      { text: text, list: p.at_xpath(".//w:numPr", "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main").present? }
    end
  end

  def scrub(text) = text.gsub(EMAIL, "").gsub(PHONE, "").gsub(/\s*\|\s*(?=\||\z)/, "").gsub(/(\s*\|\s*)+/, " | ")

  def html(paragraphs)
    out = +""
    open_list = false
    paragraphs.each do |p|
      if p[:list] && !open_list then out << "<ul>"; open_list = true end
      if !p[:list] && open_list then out << "</ul>"; open_list = false end
      text = ERB::Util.html_escape(p[:text])
      out << (p[:list] ? "<li><p>#{text}</p></li>" : "<p>#{text}</p>")
    end
    out << "</ul>" if open_list
    out
  end

  def outcome_only?(line)
    stripped = line.gsub(/\b(the\s+)?motion(s)?\b|\bmotion\s+(was\s+)?\b|[[:punct:]]/i, " ").squish
    stripped.split.size <= 3 && status_of(line).present?
  end

  def title_of(line)
    t = line.sub(/\A.*?\bMOTION\s*:\s*/i, "")
            .sub(/\A.*?\b(?i:motion(?:ed)?\s+by)\s+#{NAME}\s*[-–:,]\s*/, "")
            .sub(/\A.*?\b(?:made\s+a\s+|a\s+)?motion\s+(?:passed\s+)?(?:unanimously\s+)?(?:was\s+made\s+)?(?=to\b)/i, "")
            .sub(/[.;,\s]*\b(?:no\s+)?(?:seconded|second|2nd)\b.*\z/i, "")
            .sub(/[.;,\s]*\bmotion\s+(?:passed|carried|did not pass)\b.*\z/i, "")
            .sub(/[\s.;,\-–]+(?:passed|carried|approved|accepted|tabled|withdrawn|failed|did not pass)\b[^a-z]*\z/i, "")
            .sub(/[\s.;,\-–]+\z/, "")
    t = line if t.blank?
    t = t.sub(/\A[a-z]/, &:upcase)
    t.truncate(150, separator: " ")
  end

  def mover(line)
    line[/\b(?i:motion(?:ed)?\s+(?:made\s+)?(?:by|from))\s*:?\s*#{NAME}/, 1] ||
      line[/\(\s*(?i:motion)\s*[-–:]?\s*#{NAME}/, 1] ||
      line[/\b(?i:motion\s+to\s+\w+(?:\s+\w+)?)\s*:\s*#{NAME}/, 1] ||
      line[/(?:\A|[.;:]\s+)#{NAME}\s+(?:made\s+a\s+)?motion(?:ed)?\b/, 1]
  end

  def seconder(line)
    line[/\b(?i:seconded|second|2nd)\s*(?i:by|from)?\s*:?\s*#{NAME}/, 1].then { |n| n unless n =~ /\A(Motion|Passed|Approved|Carried)\z/i } ||
      line[/#{NAME}\s+(?:seconded|second|2nd)\b/, 1].then { |n| n unless n =~ /\A(Motion|The)\z/i }
  end

  def category_of(line)
    case line
    when /treasur|\$\d|donat|7th|seventh|bank|paypal|venmo|budget|money|funds?\b/i then "money"
    when /literature|book|pamphlet|grapevine|reading/i then "literature"
    when /elect|nominat|coordinator|chair(person)?\b|secretary|service position|commitment|sobriety requirement/i then "service"
    when /format|script|fellowship|time|minutes?\b.*\b(early|late)|zoom|chat|mute|camera|video/i then "format"
    when /business meeting|group conscience|GC\b|bylaws?/i then "meeting"
    else "other"
    end
  end
end
