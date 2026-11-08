# A made-up demo dataset for taking the Docs screenshots (script/docs_demo/shoot.js).
# Every person, group and meeting here is fictional.
#
#   ADMIN_EMAILS=demo-admin@example.com bin/rails runner script/docs_demo/seed.rb
#
# Never run this against production: it refuses to. It's meant for a throwaway development
# database (it adds to whatever is there and can be run again; it finds what it made by email).
abort "script/docs_demo/seed.rb is for a throwaway development database, not #{Rails.env}." if Rails.env.production?

PASSWORD = "demo-password-123".freeze
TODAY = Date.current

def step(name)
  yield
  puts "ok   #{name}"
rescue StandardError => e
  puts "FAIL #{name}: #{e.class}: #{e.message.lines.first}"
  puts e.backtrace.grep(/app\/|script\//).first(3).map { |l| "     #{l}" }
end

def person(email, name, username:, sober:, bio: nil, admin: false)
  u = User.find_or_initialize_by(email: email)
  u.assign_attributes(name: name, username: username, sobriety_date: sober, show_sobriety_date: true, bio: bio, admin: admin,
                      time_zone: "America/Phoenix", default_highlight_visibility: "public", default_note_visibility: "public")
  u.password = PASSWORD if u.new_record?
  u.confirmed_at ||= 2.months.ago if u.respond_to?(:confirmed_at)
  u.confirmed = true if u.respond_to?(:confirmed=)
  u.skip_confirmation! if u.respond_to?(:skip_confirmation!) && u.new_record?
  u.save!
  u
end

people = {}
step("people") do
  people[:sam] = person("demo-admin@example.com", "Sam R.", username: "sam-r", sober: TODAY - 1461, admin: true,
                        bio: "Grateful member of the Lantern Street Group. Coffee maker, chip giver, docs writer.")
  people[:jordan] = person("jordan@example.com", "Jordan K.", username: "jordan-k", sober: TODAY - 92, bio: "One day at a time. Thursday night regular.")
  people[:riley] = person("riley@example.com", "Riley M.", username: "riley-m", sober: TODAY - 2920, bio: "Sponsor, secretary, still learning.")
  people[:alex] = person("alex@example.com", "Alex P.", username: "alex-p", sober: TODAY - 400, bio: "Treasurer for Lantern Street.")
  people[:morgan] = person("morgan@example.com", "Morgan T.", username: "morgan-t", sober: TODAY - 731, bio: "Host coordinator. Ask me about service!")
  people[:casey] = person("casey@example.com", "Casey L.", username: "casey-l", sober: TODAY - 31, bio: "New here and glad to be.")
  people[:devon] = person("devon@example.com", "Devon S.", username: "devon-s", sober: TODAY - 185)
  people[:quinn] = person("quinn@example.com", "Quinn A.", username: "quinn-a", sober: TODAY - 5110, bio: "Old-timer. Keep coming back.")
  people[:taylor] = person("taylor@example.com", "Taylor B.", username: "taylor-b", sober: TODAY - 61)
  people[:jamie] = person("jamie@example.com", "Jamie W.", username: "jamie-w", sober: TODAY - 1100)
end

group = nil
step("group") do
  group = Group.find_or_initialize_by(slug: "lantern-street")
  group.assign_attributes(title: "Lantern Street Group", location: "Riverbend, AZ (and online)", remote: true, time_zone: "America/Phoenix",
                          description: "A friendly home group that meets online and in person. Newcomers welcome!",
                          website: "https://example.org/lantern-street", created_by: people[:sam], status: "active")
  group.save!
  roles = { sam: ["admin", { can_keep_records: true, can_schedule_hosts: true, can_host: true }],
            riley: ["admin", { can_keep_records: true, can_host: true }],
            morgan: ["member", { can_schedule_hosts: true, can_host: true }],
            alex: ["member", { can_keep_treasury: true, can_host: true }],
            jordan: ["member", { can_host: true }], quinn: ["member", { can_host: true }], jamie: ["member", { can_host: true }],
            casey: ["member", {}], devon: ["member", {}], taylor: ["member", {}] }
  roles.each do |key, (role, flags)|
    m = group.memberships.find_or_initialize_by(user: people[key])
    m.update!({ role: role, status: "active" }.merge(flags))
  end
  UserActiveGroup.find_or_create_by!(user: people[:sam]) { |a| a.group = group } if defined?(UserActiveGroup)
end

meetings = {}
step("meetings") do
  [
    [:sunrise, "Sunrise Big Book Study", 1, 6 * 60 + 30, 7 * 60 + 30, %w[ONL B], "https://zoom.example.com/j/1234567890"],
    [:thursday, "Thursday Night Step Meeting", 4, 19 * 60, 20 * 60, %w[ONL ST O], "https://zoom.example.com/j/1234567890"],
    [:saturday, "Saturday Speaker Meeting", 6, 10 * 60, 11 * 60, %w[SP O], nil],
  ].each do |key, name, day, start, finish, types, url|
    m = group.meetings.find_or_initialize_by(name: name)
    m.assign_attributes(recurrence: "weekly", day_of_week: day, start_minute: start, end_minute: finish, time_zone: "America/Phoenix",
                        types: types, conference_url: url, conference_url_notes: (url ? "Passcode: lantern" : nil),
                        location: (url ? nil : "Riverbend Community Center, Room 4"),
                        formatted_address: (url ? nil : "100 Example Ave, Riverbend, AZ"))
    m.save!
    meetings[key] = m
  end
  { sunrise: [:jordan, :quinn], thursday: [:morgan, :jamie], saturday: [:riley, :alex] }.each do |key, (host, co)|
    m = meetings[key]
    m.hosts.find_or_create_by!(user: people[host], role: "host") { |h| h.name = people[host].name; h.starts_on = TODAY - 30 }
    m.hosts.find_or_create_by!(user: people[co], role: "co_host") { |h| h.name = people[co].name; h.starts_on = TODAY - 30 }
  end
end

step("chat") do
  general = group.chat_channels.find_or_create_by!(name: "general") { |c| c.topic = "Anything and everything" }
  hosts = group.chat_channels.find_or_create_by!(name: "hosts") { |c| c.topic = "Host schedule, swaps and subs"; c.access_roles = ["hosts"] }
  group.chat_channels.find_or_create_by!(name: "rides") { |c| c.topic = "Need a ride to Saturday's meeting? Ask here." }
  if general.messages.none?
    t = Time.current.in_time_zone("America/Phoenix").change(hour: 7, min: 40)
    t -= 1.day if t > 2.hours.ago
    msgs = [
      [:quinn, "Good morning, Lantern Street! Coffee's on at the Saturday meeting this week."],
      [:casey, "Thank you all for last night. I picked up my 30 day chip and my hands were shaking 😅"],
      [:riley, "So proud of you @Casey L.! Keep coming back."],
      [:alex, "Reminder: the business meeting is the first Sunday of the month. Agenda items to me by Friday."],
      [:jordan, "Does anyone have the Zoom link for Thursday? I lost it."],
      [:morgan, "It's on the group page under Meetings, or here: https://zoom.example.com/j/1234567890"],
    ]
    created = msgs.each_with_index.map do |(who, body), i|
      general.messages.create!(user: people[who], body: body, created_at: t + (i * 37).minutes, updated_at: t + (i * 37).minutes)
    end
    created[2].update!(reply_to: created[1])
    created[3].update!(pinned_at: Time.current, pinned_by: people[:sam])
    if defined?(ChatReaction)
      %i[sam jordan quinn morgan].each { |who| ChatReaction.create!(chat_message: created[1], user: people[who], emoji: "❤️") rescue nil }
      %i[sam alex].each { |who| ChatReaction.create!(chat_message: created[1], user: people[who], emoji: "🎉") rescue nil }
      ChatReaction.create!(chat_message: created[3], user: people[:riley], emoji: "👍") rescue nil
    end
  end
  if hosts.messages.none?
    hosts.messages.create!(user: people[:morgan], body: "Can anyone cover Thursday on the 20th? I'll be traveling.", created_at: 2.hours.ago)
    hosts.messages.create!(user: people[:jamie], body: "I've got it! Swapped in the schedule.", created_at: 1.hour.ago)
  end
end

step("events") do
  e = group.events.find_or_initialize_by(title: "Lantern Street Gratitude Potluck")
  e.assign_attributes(created_by: people[:sam], status: "published", time_zone: "America/Phoenix",
                      short_description: "Bring a dish, bring a friend. Speaker at 7, food at 6.",
                      starts_at: (TODAY + 12).in_time_zone("America/Phoenix").change(hour: 18),
                      ends_at: (TODAY + 12).in_time_zone("America/Phoenix").change(hour: 21),
                      location: "Riverbend Community Center, 100 Example Ave")
  e.save!
  { jordan: "going", casey: "going", quinn: "going", riley: "going", devon: "maybe" }.each do |who, status|
    e.rsvps.find_or_create_by!(user: people[who]) { |r| r.status = status }
  end
end

step("chips") do
  [[:casey, "30d", nil, TODAY - 1, :riley, "So glad you're here. Keep coming back!"],
   [:jordan, "90d", nil, TODAY - 2, :sam, "Ninety days! Proud of you."],
   [:alex, "year", 1, TODAY - 35, :morgan, nil],
   [:taylor, "60d", nil, TODAY - 1, :sam, nil]].each do |who, key, years, on, giver, note|
    next if ChipAward.exists?(user: people[who], milestone_key: key, years: years)

    ChipAward.create!(group: group, user: people[who], email: people[who].email, given_by: people[giver], milestone_key: key, years: years, on: on,
                      note: note.to_s, claimed_at: on.to_time + 1.hour)
  end
end

step("gratitude and 10th step") do
  lists = [
    ["My sponsor picked up on the first ring", "Coffee with Quinn after the meeting", "Sleeping through the night", "The dog"],
    ["A quiet morning", "Thursday's meeting", "My sister called"],
    ["Rain!", "Being of service at the door", "Another day sober"],
  ]
  lists.each_with_index do |items, i|
    GratitudeList.find_or_create_by!(user: people[:sam], on: TODAY - i) { |g| g.items = items }
    GratitudeList.find_or_create_by!(user: people[:jordan], on: TODAY - i) { |g| g.items = items.reverse }
  end
  [people[:sam], people[:jordan]].each do |u|
    StepInventory.find_or_create_by!(user: u, on: TODAY - 1) do |s|
      s.answers = { "resentful" => { "answer" => "yes", "note" => "Got short with a driver in traffic. Let it go by lunch." },
                    "selfish" => { "answer" => "no" }, "dishonest" => { "answer" => "no" },
                    "afraid" => { "answer" => "yes", "note" => "Worried about the job interview." },
                    "apology" => { "answer" => "no" }, "kind" => { "answer" => "yes", "note" => "Called Casey to check in." },
                    "better" => { "note" => "Pause before I answer emails." } }
      s.notes = "A good day overall. Grateful."
    end
  end
end

step("follows and notes") do
  pairs = [%i[sam riley], %i[sam jordan], %i[sam quinn], %i[jordan sam], %i[jordan riley], %i[casey riley], %i[riley sam], %i[quinn sam], %i[alex sam], %i[morgan sam]]
  pairs.each { |a, b| Follow.find_or_create_by!(follower: people[a], followed: people[b]) }
  notes = [
    [:riley, "Three things that helped me today: a phone call, a meeting, and a walk around the block. #gratitude", 5.hours.ago],
    [:jordan, "92 days. Didn't think I'd see 9 days, let alone 90. Thank you, Lantern Street. #milestone", 1.day.ago],
    [:quinn, "\"Keep it simple\" isn't a slogan, it's a survival skill.", 2.days.ago],
  ]
  notes.each do |who, body, at|
    TimelineNote.find_or_create_by!(user: people[who], body: body) { |n| n.visibility = "public"; n.created_at = at; n.updated_at = at }
  end
end

step("service positions") do
  [["Secretary", :riley, 12], ["Treasurer", :alex, 12], ["Host coordinator", :morgan, 6], ["GSR", :quinn, 24]].each_with_index do |(title, who, months), i|
    pos = group.service_positions.find_or_create_by!(title: title) { |p| p.term_months = months; p.position = i; p.sobriety_months = 6 }
    pos.terms.find_or_create_by!(user: people[who]) { |t| t.name = people[who].name; t.starts_on = TODAY - 120 } if pos.respond_to?(:terms)
  end
end

step("sponsorship") do
  Sponsorship.find_or_create_by!(sponsor: people[:riley], sponsee: people[:jordan]) { |s| s.status = "active"; s.started_on = TODAY - 80; s.current_step = 4 }
  Sponsorship.find_or_create_by!(sponsor: people[:riley], sponsee: people[:casey]) { |s| s.status = "active"; s.started_on = TODAY - 20; s.current_step = 1 }
  Sponsorship.find_or_create_by!(sponsor: people[:sam], sponsee: people[:devon]) { |s| s.status = "active"; s.started_on = TODAY - 150; s.current_step = 6 }
end


# What the migrations install on a real database (a schema load skips their data)
step("built-in templates and docs") do
  ChipTemplateStarters.install if ChipTemplate.none?
  if StepTemplate.none?
    Dir[Rails.root.join("config/step_tools/*.yml")].sort.each_with_index do |file, i|
      data = YAML.safe_load_file(file)
      definition = StepTool.clean(data.slice("intro", "sections", "credit", "layout"))
      t = StepTemplate.create!(key: data["key"], step: data["step"].to_i, steps: Array(data["steps"] || [data["step"]]).map(&:to_i), name: data["name"],
                               summary: data["summary"], credit: data["credit"], default: !!data["default"], position: i, definition: definition,
                               draft: definition, version: 1, published_at: Time.current)
      t.versions.create!(number: 1, name: data["name"], definition: definition)
    end
  end
  if LanguageRule.none?
    starter = YAML.load_file(Rails.root.join("config/blocked_language.yml"))
    { "anywhere" => "anywhere", "words" => "word", "allowed" => "allowed" }.each do |key, kind|
      Array(starter[key]).map { |t| t.to_s.downcase.squish }.uniq.each { |term| LanguageRule.create!(kind: kind, term: term, note: "Starter list") }
    end
  end
  load Rails.root.join("db/seeds/sharing_modes.rb") unless SharingMode.exists?
  DocsImport.run
  unless Book.exists?
    Rails.application.load_tasks
    Rake::Task["books:import"].invoke(Rails.root.join("db/the-big-book-of-alcoholics-anonymous-export-20250826-193221.json").to_s)
  end
end

step("topics") do
  set = TopicSet.find_or_create_by!(name: "Lantern Street favorites") { |s| s.description = "Topics our home group keeps coming back to." }
  cats = {
    "Acceptance" => "heart-handshake", "Gratitude" => "sun", "Fear and faith" => "shield", "Service" => "hand-helping", "One day at a time" => "calendar",
  }.map { |title, icon| TopicCategory.find_or_create_by!(title: title) { |c| c.icon_name = icon } }
  [
    ["What does acceptance look like for you this week?", "Acceptance is not approval. Where are you being asked to accept something you can't change?", 0],
    ["Gratitude when it's hard", "Name one thing you're grateful for on a day when nothing seems to go right.", 1],
    ["The first time I asked for help", "What made it possible to reach out? What would you tell someone who can't yet?", 2],
    ["Being of service", "How has making coffee, greeting at the door or sponsoring changed your recovery?", 3],
    ["Just for today", "What's one thing you can do today that you couldn't promise to do for a lifetime?", 4],
    ["Fear of the future", "When worry about tomorrow shows up, what brings you back to today?", 2],
    ["Rebuilding trust", "How are relationships with family or friends changing as you stay sober?", 0],
    ["Humility", "What does humility mean to you, and how is it different from humiliation?", 4],
  ].each_with_index do |(title, subtitle, cat), i|
    Topic.find_or_create_by!(title: title) { |t| t.subtitle = subtitle; t.topic_category = cats[cat]; t.topic_set_id = set.id; t.searchable_number = (101 + i).to_s; t.difficulty = "standard" }
  end
end

step("service readings") do
  steps = [
    "We admitted we were powerless over alcohol, that our lives had become unmanageable.",
    "Came to believe that a Power greater than ourselves could restore us to sanity.",
    "Made a decision to turn our will and our lives over to the care of God as we understood Him.",
    "Made a searching and fearless moral inventory of ourselves.",
    "Admitted to God, to ourselves, and to another human being the exact nature of our wrongs.",
    "Were entirely ready to have God remove all these defects of character.",
    "Humbly asked Him to remove our shortcomings.",
    "Made a list of all persons we had harmed, and became willing to make amends to them all.",
    "Made direct amends to such people wherever possible, except when to do so would injure them or others.",
    "Continued to take personal inventory and when we were wrong promptly admitted it.",
    "Sought through prayer and meditation to improve our conscious contact with God as we understood Him, praying only for knowledge of His will for us and the power to carry that out.",
    "Having had a spiritual awakening as the result of these steps, we tried to carry this message to alcoholics, and to practice these principles in all our affairs.",
  ]
  sr = ServiceReading.find_or_create_by!(title: "The Twelve Steps") { |r| r.short_title = "Steps"; r.source = "Alcoholics Anonymous, page 59"; r.icon = "footprints" }
  sr.update!(body: "<ol>#{steps.map { |t| "<li>#{t}</li>" }.join}</ol>") if sr.body.blank?
  pr = ServiceReading.find_or_create_by!(title: "The Serenity Prayer") { |r| r.short_title = "Serenity"; r.source = "Traditional"; r.icon = "sun" }
  pr.update!(body: "<p>God, grant me the serenity to accept the things I cannot change,<br>courage to change the things I can,<br>and wisdom to know the difference.</p>") if pr.body.blank?
  wl = ServiceReading.find_or_create_by!(title: "Lantern Street Welcome") { |r| r.short_title = "Welcome"; r.source = "Lantern Street Group (example)"; r.icon = "door-open" }
  wl.update!(body: "<p>Welcome to the Lantern Street Group. If this is your first meeting, you are the most important person here. Please stay after the meeting so we can say hello and share phone numbers.</p>") if wl.body.blank?
end

step("readings archive") do
  tag = ->(t) { Tag.find_or_create_by!(title: t) }
  [
    [:riley, "On asking for help", "Reflection by a Lantern Street member",
     "<p>For years I thought asking for help meant I had failed. The first night I raised my hand, nothing dramatic happened. Someone handed me a phone list and said, \"Call before you need to.\" I didn't, at first. But the list stayed in my wallet, and one night it was the only thing I had.</p><p>Tonight let's talk about the first time we asked for help, and what made it possible.</p>",
     "Asking for help", %w[help newcomers], 3.days.ago],
    [:quinn, "Keep it simple", "Reflection by a Lantern Street member",
     "<p>When I came in I wanted to understand everything before I did anything. An old-timer told me: don't drink, go to meetings, ask for help. I said that was too simple. She said, \"Then it shouldn't be hard.\"</p>",
     "Simplicity", %w[slogans], 10.days.ago],
    [:sam, "Gratitude in a hard week", "Reflection by a Lantern Street member",
     "<p>Gratitude isn't pretending things are fine. Some weeks my list is short: I didn't drink, I made a call, I showed up. Those weeks the list matters most.</p>",
     "Gratitude", %w[gratitude], 17.days.ago],
  ].each do |who, title, source, html, topic, tags, at|
    r = Reading.find_or_initialize_by(title: title)
    next unless r.new_record?

    r.assign_attributes(user: people[who], source: source, host: people[who].name, group: group, meetingName: "Thursday Night Step Meeting", published_at: at)
    r.content = html
    r.topic = "<p>#{topic}</p>"
    r.save!
    tags.each { |t| r.tags << tag.(t) }
  end
end

step("conscience: business meeting, decisions") do
  past = group.business_meetings.find_or_initialize_by(held_on: TODAY.beginning_of_month)
  past.assign_attributes(status: "held", chair_name: "Riley M.", secretary_name: "Sam R.", attendance_count: 11, created_by: people[:riley],
                         starts_at: TODAY.beginning_of_month.in_time_zone("America/Phoenix").change(hour: 11, min: 15),
                         minutes_status: "posted", minutes_posted_at: 2.days.ago, visibility: "members",
                         minutes: "<h2>Opening</h2><p>Riley M. opened the meeting at 11:15 with the Serenity Prayer. 11 members present; quorum met.</p><h2>Reports</h2><ul><li><strong>Treasurer (Alex P.)</strong>: $412.50 in the basket, $180 rent paid. Report accepted.</li><li><strong>Host coordinator (Morgan T.)</strong>: every Thursday is covered through December.</li></ul><h2>New business</h2><ul><li>Motion to buy 20 copies of the Big Book for newcomers (up to $250). Passed, 10 for, 0 against, 1 abstaining.</li><li>Gratitude potluck planned for later this month. Sam R. will make the event page.</li></ul><h2>Closing</h2><p>Closed at 12:05 with the Responsibility Statement.</p>")
  past.save!
  upcoming_day = (TODAY + 1.month).beginning_of_month
  upcoming_day += 1 until upcoming_day.sunday?
  nxt = group.business_meetings.find_or_initialize_by(held_on: upcoming_day)
  nxt.assign_attributes(status: "planned", created_by: people[:riley], minutes_status: "draft", visibility: "members",
                        starts_at: upcoming_day.in_time_zone("America/Phoenix").change(hour: 11, min: 15), meeting: meetings[:saturday])
  nxt.save!
  if nxt.respond_to?(:agenda_items) && nxt.agenda_items.none?
    nxt.agenda_items.create!(title: "Treasurer's report", kind: "report", status: "on_agenda", submitted_by: people[:alex], position: 1)
    nxt.agenda_items.create!(title: "Move the Saturday meeting to Room 6?", kind: "new_business", status: "on_agenda", submitted_by: people[:jamie], position: 2,
                             details: "Room 4 is getting crowded. The community center offered Room 6 at the same rent.")
    nxt.agenda_items.create!(title: "Start a newcomer welcome table", kind: "new_business", status: "suggested", submitted_by: people[:casey], position: 3)
  end
  [
    ["Buy 20 Big Books for newcomers", "That the group buy 20 copies of Alcoholics Anonymous to give to newcomers, spending up to $250.", "passed", "money", 10, 0, 1, "Alex P.", "Quinn A."],
    ["Hold a gratitude potluck in November", "That the group hold a gratitude potluck with a speaker in November.", "passed", "other", 11, 0, 0, "Sam R.", "Jamie W."],
    ["Keep 3 months of rent as prudent reserve", "That the group's prudent reserve be three months of rent ($540).", "passed", "money", 9, 1, 1, "Alex P.", "Riley M."],
    ["Add a 7th Tradition QR code to the script", "That the host read out the QR code link for online contributions after the 7th Tradition.", "tabled", "format", nil, nil, nil, "Morgan T.", "Devon S."],
  ].each_with_index do |(title, text, status, cat, yes, no, abst, mover, seconder), i|
    group.motions.find_or_create_by!(title: title) do |m|
      m.assign_attributes(text: text, status: status, category: cat, votes_for: yes, votes_against: no, abstentions: abst, moved_by_name: mover,
                          seconded_by_name: seconder, decided_on: past.held_on - (i.zero? ? 0 : 30 * i), business_meeting: (i.zero? ? past : nil),
                          created_by: people[:sam], visibility: "members", kind: "main")
    end
  end
end

step("conscience: documents, treasury") do
  docs = [
    ["Thursday meeting format", "format", "members", "current", "# Before we begin\n\nWelcome to the Thursday Night Step Meeting of the Lantern Street Group. My name is {{ host }} and I'm your host tonight.\n\n# Readings\n\n- How It Works: read by {{ service_hiw }}\n- The Twelve Traditions: read by {{ service_traditions }}\n\n# Introductions\n\nIs anyone here for their first, second or third meeting? Welcome!\n\n# Milestones\n\nIs anyone celebrating a milestone today?\n\n# Discussion\n\nTonight we're reading Step {{ step }}. Shares are about 3 minutes; {{ service_timer }} will keep time.\n\n# 7th Tradition\n\nWe have no dues or fees; we are self-supporting through our own contributions.\n\n# Closing\n\n{{ service_closing }} will close us with the Responsibility Statement."],
    ["Group guidelines", "guidelines", "public", "current", "# Lantern Street Group guidelines\n\n1. Shares are about 3 minutes so everyone gets a turn.\n2. Please keep cameras on when you can, and mute when you're not sharing.\n3. What you hear here, let it stay here.\n4. Newcomers are welcome to just listen."],
    ["Host checklist", "service", "hosts", "current", "# Host checklist\n\n- [ ] Open the room 10 minutes early\n- [ ] Line up readers for How It Works and the Traditions\n- [ ] Ask about newcomers and milestones\n- [ ] Post the 7th Tradition link in the chat"],
    ["Bylaws (draft)", "other", "keepers", "draft", "# Bylaws\n\n## Article 1: Name\n\nThis group is the Lantern Street Group.\n\n## Article 2: Purpose\n\nOur primary purpose is to stay sober and help others to achieve sobriety."],
  ]
  docs.each_with_index do |(title, kind, vis, status, body), i|
    next if group.documents.exists?(title: title)

    d = group.documents.new(title: title, kind: kind, visibility: vis, status: status, body: body, body_format: "markdown", position: i,
                            created_by: people[:riley], updated_by: people[:riley], pinned: i.zero?)
    d.respond_to?(:revise) ? d.revise({}, people[:riley], message: "First version") : d.save!
  end
  [[TODAY.prev_month.beginning_of_month, "posted", 68_000], [TODAY.prev_month(2).beginning_of_month, "posted", 61_500]].each do |period, status, opening|
    group.treasurer_reports.find_or_create_by!(period_on: period) do |r|
      r.assign_attributes(created_by: people[:alex], status: status, visibility: "members", opening_cents: opening, reserve_cents: 54_000,
                          lines: [{ kind: "income", label: "7th Tradition (basket)", cents: 31_250 }, { kind: "income", label: "7th Tradition (online)", cents: 10_000 },
                                  { kind: "expense", label: "Rent, community center", cents: 18_000 }, { kind: "expense", label: "Literature", cents: 6_400 },
                                  { kind: "expense", label: "Coffee and supplies", cents: 2_350 }],
                          splits: [{ label: "District", percent: 30 }, { label: "Area", percent: 10 }, { label: "General Service Office", percent: 60 }],
                          notes: "Bought 20 Big Books for newcomers (approved last month).")
    end
  end
end

step("hosting kit and sub requests") do
  script = group.documents.find_by(title: "Thursday meeting format")
  kit = group.hosting_kits.find_or_initialize_by(meeting_id: nil)
  kit.assign_attributes(script_document: script, readings: [{ "url" => "http://localhost:3000/service_readings", "title" => "Service Readings" }])
  kit.save!
  if kit.postings.none?
    kit.postings.create!(title: "Welcome", icon: "hand", minute: 0, body: "Welcome to the Thursday Night Step Meeting! Passcode for next week: {{ zoom_passcode }}")
    kit.postings.create!(title: "7th Tradition", icon: "heart", minute: 45, body: "We're self-supporting through our own contributions. Contribute online: https://example.org/lantern-street/7th")
    kit.postings.create!(title: "Phone list", icon: "phone", minute: 55, body: "Want to be on the phone list? Message Morgan T. after the meeting.")
  end
  thu = meetings[:thursday]
  day = TODAY + ((thu.day_of_week - TODAY.wday) % 7) + 14
  HostSubRequest.find_or_create_by!(meeting: thu, on: day, role: "host") { |r| r.requested_by = people[:morgan]; r.status = "open"; r.note = "Traveling for work." }
  sat = meetings[:saturday]
  sday = TODAY + ((sat.day_of_week - TODAY.wday) % 7) + 7
  MeetingHostCover.find_or_create_by!(meeting: sat, on: sday, role: "co_host") { |c| c.user = people[:sam]; c.name = "Sam R." }
end

step("polls") do
  poll = Poll.find_or_initialize_by(question: "Which day works best for the gratitude potluck?")
  if poll.new_record?
    poll.assign_attributes(user: people[:sam], group: group, max_choices: 1, audience: "members", results_visibility: "always", voters_visibility: "members", guest_names: "off",
                           details: "Pick the evening you can make. We'll book the hall for the winner.")
    ["Friday the 20th", "Saturday the 21st", "Sunday the 22nd"].each_with_index { |l, i| poll.options.build(label: l, position: i) }
    poll.save!
    if defined?(PollBallot)
      opts = poll.options.order(:position).to_a
      { jordan: 1, casey: 1, quinn: 0, riley: 1, alex: 2, morgan: 1, devon: 0 }.each do |who, idx|
        PollBallot.create!(poll: poll, user: people[who], voter_token: SecureRandom.hex(8), option_ids: [opts[idx].id])
      end
    end
  end
end

step("notifications") do
  sam = people[:sam]
  if sam.notifications.none?
    sam.notifications.create!(kind: "mention", title: "Riley M. mentioned you in #general", body: "@Sam R. can you bring the chips on Saturday?", url: "/groups/lantern-street/messages", created_at: 20.minutes.ago)
    sam.notifications.create!(kind: "host_sub", title: "Morgan T. needs a sub", body: "Thursday Night Step Meeting, two weeks from now", url: "/people/me/hosting", created_at: 2.hours.ago)
    sam.notifications.create!(kind: "follow", title: "Casey L. followed you", url: "/people/casey-l", created_at: 1.day.ago, read_at: 1.day.ago)
  end
end


step("step work and my readings") do
  [people[:sam], people[:jordan]].each do |u|
    next if u.step_works.exists?(step: 1)

    w = StepWork.start!(u, StepTool.find("step1-powerlessness"))
    w.update!(answers: {
      "readings" => { "r1" => true, "r2" => true },
      "control" => [{ "when" => "My cousin's wedding", "meant" => "Two glasses of wine, then switch to soda", "happened" => "Left before the toasts. Don't remember the drive home." },
                    { "when" => "Every Friday after work", "meant" => "One drink with the team", "happened" => "Closed the bar most weeks." }],
      "stopping" => ["Only beer", "Only on weekends", "Never before 5 pm", "Switching to a smaller glass"],
      "unmanageable" => { "relationships" => "My sister stopped inviting me to family dinners.", "work" => "Two written warnings for being late on Mondays." },
    })
  end
  unless Reading.exists?(title: "Showing up anyway")
    r = Reading.new(title: "Showing up anyway", user: people[:sam], source: "Reflection by a Lantern Street member", host: "Sam R.", group: group, meetingName: "Sunrise Big Book Study")
    r.content = "<p>Some mornings the last thing I want is a 6:30 meeting. I go anyway, and I've never once regretted it.</p>"
    r.topic = "<p>Showing up</p>"
    r.save!
  end
end

step("online meeting listings (made up)") do
  [
    ["Morning Light Online", "Morning Light Group", (0..6).to_a, "07:00", "08:00", "America/New_York", %w[O D]],
    ["Night Owls Big Book", "Night Owls", [1, 3, 5], "21:30", "22:30", "America/Los_Angeles", %w[B C]],
    ["Women's Step Study", "Bluebird Women's Group", [2], "18:00", "19:00", "America/Chicago", %w[W ST]],
    ["Spanish Speaking Online", "Grupo Esperanza (example)", [0, 4], "19:00", "20:30", "America/Denver", %w[S O]],
    ["Lunch Bunch Daily Reflections", "Lunch Bunch", (1..5).to_a, "12:00", "13:00", "America/Phoenix", %w[O DR]],
  ].each_with_index do |(name, group_name, days, start, finish, tz, types), i|
    OiaaMeeting.find_or_create_by!(slug: "demo-#{name.parameterize}") do |m|
      m.assign_attributes(name: name, group_name: group_name, days: days, start_time: start, end_time: finish, time_zone: tz, types: types,
                          conference_url: "https://zoom.example.com/j/98765432#{i}0", conference_url_notes: "Passcode: #{%w[sober light owl blue hope][i]}",
                          attendance_option: "online", url: "https://example.org/meetings/#{name.parameterize}", last_seen_at: Time.current)
    end
  end
end

step("site notice (scheduled, so it doesn't show on every page)") do
  SiteNotice.find_or_create_by!(title: "New: share a chip as a picture") do |n|
    n.assign_attributes(summary: "Open any chip and choose Picture or video to post it anywhere.", tone: "info", audience: "everyone", active: true,
                        starts_at: 3.weeks.from_now, ends_at: 5.weeks.from_now, user: people[:sam], link_url: "/docs/step-work/chips", link_label: "How it works")
  end
end

# Highlights are made in the reader by script/docs_demo/setup.js; run this again after it to add notes
step("highlight notes") do
  notes = {
    "Half measures" => ["Read this one at Thursday's meeting. #step3 @Riley M. this is the line you told me about.", "public"],
    "Those who do not recover" => ["**Thoroughly.** That's the word I keep coming back to.", "followers"],
    "We will not regret the past" => ["My favorite promise. #promises", "public"],
  }
  UserHighlight.where(user: [people[:sam], people[:riley]]).find_each do |h|
    quote = h.selector.dig("quote", "exact").to_s
    key = notes.keys.find { |k| quote.start_with?(k) } or next
    note, vis = notes[key]
    h.update!(note: note, visibility: vis, shared_at: 2.days.ago)
  end
end

puts "\nSign in as demo-admin@example.com / #{PASSWORD} (site admin when ADMIN_EMAILS includes it)."
