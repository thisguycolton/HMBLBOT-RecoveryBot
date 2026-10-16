# The words of a court verification email. A group can write its own subject and body
# (on its Court tab), with {{placeholders}} that are filled in from the form when a host
# sends the letter. Without a group, or with nothing written, the defaults below are used.
#
#   letter = CourtLetter.new(verification)
#   letter.subject       "Verification of AA Meeting Attendance"
#   letter.text          the body with every placeholder filled in
#   letter.paragraphs    the same as [[[label, value] | [nil, line], ...], ...] for HTML
class CourtLetter
  # placeholder => what the editor and the form call it
  FIELDS = {
    "attendee" => "Attendee name",
    "meeting_time" => "Meeting date and time",
    "topic" => "Topic",
    "host" => "Host",
    "signer" => "Signer",
    "group" => "Group name",
  }.freeze
  PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/

  DEFAULT_SUBJECT = "Verification of AA Meeting Attendance".freeze
  BODY = <<~TEXT.freeze
    To whom it may concern,

    This email verifies that {{attendee}} attended an Alcoholics Anonymous meeting.

    Meeting date / time: {{meeting_time}}
    Topic: {{topic}}
    Host: {{host}}
    Group: {{group}}

    %<contact>s

    Sincerely,
    {{group}}
    Signed by {{signer}}
  TEXT
  # The Acid Test's letters (the plain form) have always pointed here
  ACID_TEST_CONTACT = "If you require additional verification, please email AAAcidTest@gmail.com.".freeze
  GROUP_CONTACT = "If you require additional verification, please reply to this email.".freeze

  def self.default_body(group) = format(BODY, contact: group ? GROUP_CONTACT : ACID_TEST_CONTACT)

  # Placeholders a template uses that aren't in FIELDS
  def self.unknown_placeholders(template) = template.to_s.scan(PLACEHOLDER).flatten.uniq - FIELDS.keys

  def self.fill(template, values) = template.to_s.gsub(PLACEHOLDER) { values.fetch(Regexp.last_match(1), Regexp.last_match(0)).to_s }

  attr_reader :verification

  def initialize(verification)
    @verification = verification
  end

  def group = verification.group

  def subject = self.class.fill(group&.court_email_subject.presence || DEFAULT_SUBJECT, values).squish

  def text = self.class.fill(body_template, values).strip

  # Paragraphs (split on blank lines) of lines. A short "Label: value" line becomes
  # [label, value], so the email can set the label apart; any other line is [nil, line].
  def paragraphs
    text.split(/\n\s*\n/).map do |para|
      para.lines.map(&:strip).reject(&:empty?).map do |line|
        line =~ /\A([^:]{1,30}):\s+(.+)\z/ ? [Regexp.last_match(1), Regexp.last_match(2)] : [nil, line]
      end
    end
  end

  def values
    {
      "attendee" => verification.respondent_name,
      "meeting_time" => verification.meeting_at && verification.meeting_time_label,
      "topic" => verification.topic.presence || "N/A",
      "host" => verification.host_name,
      "signer" => verification.signer_name,
      "group" => verification.group_label,
    }
  end

  private

  def body_template = group&.court_email_body.presence || self.class.default_body(group)
end
