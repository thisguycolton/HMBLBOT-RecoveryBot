# "Needs your attention" at the top of Steps (/recovery/steps): the step work and sponsorship
# things waiting on a member, most pressing first. Each item is
# { key, kind, title, body, url } with `url` inside the recovery app (react-router path).
#
# - someone asked them to be their sponsor
# - a sponsee sent them something they haven't opened
# - their sponsor left a note on something they sent (this past week), suggested a worksheet,
#   or checked in on their step work (until they work on something)
# - Step 8 names marked "Yes, talk with sponsor", and Step 9 amends talked over and ready to make
# - a worksheet they haven't touched in a week or more
# - having finished a step, the next one (when they haven't started it)
#
# Only ever their own things. The 10th step, gratitude list and chips to claim come from
# /api/recovery on the page itself.
module StepAttention
  STALE = 7.days
  NOTE_FRESH = 7.days

  module_function

  def for(user)
    items = []
    Sponsorship.where(sponsor_id: user.id, status: "pending").includes(:sponsee).order(:created_at).each do |s|
      items << { key: "ask:#{s.id}", kind: "sponsorship", title: "#{s.sponsee.display_name} asked you to be their sponsor",
                 body: s.note.presence || "Say yes or no on Sponsorship.", url: "/sponsorship" }
    end

    unseen = SponsorshipShare.joins(:sponsorship).merge(Sponsorship.where(sponsor_id: user.id, status: "active"))
                             .where(seen_at: nil).includes(sponsorship: :sponsee).order(:created_at)
    unseen.group_by(&:sponsorship).each do |s, shares|
      what = shares.size == 1 ? shares.first.title : "#{shares.size} things"
      items << { key: "sent:#{s.id}", kind: "sponsorship", title: "#{s.sponsee.display_name} sent you #{what}",
                 body: "Read it and leave a note if you'd like.", url: "/sponsorship/#{s.id}" }
    end

    notes = SponsorshipShare.joins(:sponsorship).merge(Sponsorship.where(sponsee_id: user.id, status: "active"))
                            .where(replied_at: NOTE_FRESH.ago..).includes(sponsorship: :sponsor).order(replied_at: :desc)
    notes.each do |share|
      items << { key: "note:#{share.id}", kind: "note", title: "#{share.sponsorship.sponsor.display_name} left a note on #{share.title}",
                 body: share.reply.to_s.truncate(140), url: "/sponsorship" }
    end

    StepSuggestion.waiting.joins(:sponsorship).merge(Sponsorship.active.where(sponsee_id: user.id))
                  .includes(sponsorship: :sponsor).order(:created_at).each do |sg|
      items << { key: "suggest:#{sg.id}", kind: "sponsorship", title: "#{sg.sponsorship.sponsor.display_name} suggested #{sg.name}",
                 body: sg.note.presence || "Start it when you're ready, or set it aside.", url: "/steps#suggested" }
    end

    works = user.step_works.order(updated_at: :desc).to_a
    last_worked = works.map(&:updated_at).max

    # Their sponsor checked in this past week, and they haven't worked on anything since
    Sponsorship.active.where(sponsee_id: user.id, nudged_at: NOTE_FRESH.ago..).includes(:sponsor).each do |s|
      next if last_worked && last_worked > s.nudged_at

      items << { key: "nudge:#{s.id}:#{s.nudged_at.to_i}", kind: "sponsorship", title: "#{s.sponsor.display_name} is checking in on your step work",
                 body: s.nudge_note || (s.current_step ? "You're on Step #{s.current_step}." : "Pick up where you left off."), url: s.current_step ? "/steps#step-#{s.current_step}" : "/steps" }
    end
    works.each { |w| items.concat(rows_waiting(w)) }

    works.select { |w| w.status != "done" && w.updated_at < STALE.ago }.each do |w|
      days = ((Time.current - w.updated_at) / 1.day).floor
      items << { key: "stale:#{w.id}", kind: "work", title: "Pick #{w.name} back up?",
                 body: "You last worked on it #{days} days ago. No rush; it's here when you're ready.", url: "/steps/#{w.id}" }
    end

    last_done = works.select { |w| w.status == "done" }.max_by(&:done_at)
    if last_done && last_done.step < 12 && works.none? { |w| w.step > last_done.step }
      nxt = last_done.step + 1
      items << { key: "next:#{nxt}", kind: "next", title: "Ready for Step #{nxt}?",
                 body: "You finished #{last_done.name}. Talk it over with your sponsor, then start Step #{nxt} when you're ready.", url: "/steps#step-#{nxt}" }
    end
    items
  end

  # Rows in a Step 8 or 9 table that are waiting on a talk with the sponsor or ready to make
  def rows_waiting(work)
    (work.definition["sections"] || []).filter_map do |section|
      next unless section["kind"] == "table"

      rows = Array(work.answers[section["id"]]).select { |r| r.is_a?(Hash) }
      who = section["columns"]&.first&.dig("id")
      names = ->(list) { list.map { |r| r[who].to_s.strip.presence }.compact.first(3).join(", ") }
      if (col = section["columns"]&.find { |c| Array(c["options"]).include?("Yes, talk with sponsor") })
        talk = rows.select { |r| r[col["id"]] == "Yes, talk with sponsor" }
        next if talk.empty?

        { key: "talk:#{work.id}", kind: "work", title: "#{count(talk.size, 'amends')} to talk over with your sponsor",
          body: "On #{work.name}: #{names.call(talk)}#{talk.size > 3 ? ' and more' : ''}.", url: "/steps/#{work.id}" }
      elsif (col = section["columns"]&.find { |c| Array(c["options"]).include?("Talked over with sponsor") })
        ready = rows.select { |r| r[col["id"]] == "Talked over with sponsor" }
        next if ready.empty?

        { key: "ready:#{work.id}", kind: "work", title: "#{count(ready.size, 'amends')} talked over and ready to make",
          body: "On #{work.name}: #{names.call(ready)}#{ready.size > 3 ? ' and more' : ''}.", url: "/steps/#{work.id}" }
      end
    end
  end

  def count(n, word) = n == 1 ? "One #{word}" : "#{n} #{word}"
end
