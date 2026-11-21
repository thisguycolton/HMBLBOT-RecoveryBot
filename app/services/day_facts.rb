# The fun day-count facts (app/javascript/lib/dayFacts.json, one per day count), for the
# Ruby side: a fact's share page and picture (FactsController, FactCard) and Site Admin's
# "Fun facts this week" (MemberStats).
module DayFacts
  FILE = Rails.root.join("app/javascript/lib/dayFacts.json")
  TOPICS = { "space" => "Space", "nature" => "Nature", "history" => "History", "numbers" => "Numbers", "body" => "The body" }.freeze

  Fact = Struct.new(:days, :topic, :title, :detail, keyword_init: true) do
    def days_label = "#{days.to_fs(:delimited)} #{days == 1 ? 'day' : 'days'}"
    def topic_label = TOPICS.fetch(topic, "Fun fact")
    def path = "/facts/#{days}"
    # Some titles are just the count ("2,000 days"); a picture or page that already shows the
    # count big leads with the detail then, so it doesn't say "2,000 days" twice
    def plain? = title.to_s.squish == days_label
    def headline = plain? ? detail : title
    def subline = plain? ? nil : detail
    def share_title = plain? ? days_label : "#{days_label}: #{title}"
  end

  def self.all
    @all = nil if Rails.env.development? # the list is edited by hand
    @all ||= JSON.parse(File.read(FILE)).map { |f| Fact.new(days: f["days"], topic: f["topic"], title: f["title"], detail: f["detail"]) }.freeze
  end

  def self.find(days)
    n = Integer(days.to_s, 10)
    all.find { |f| f.days == n }
  rescue ArgumentError
    nil
  end
end
