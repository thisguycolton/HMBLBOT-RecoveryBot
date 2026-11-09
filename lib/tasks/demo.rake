# A made-up world for demo videos and screenshots: 8 fake groups (a logo and a cover each,
# meetings at believable times), 32 fake people with cartoon pictures and the roles a group
# needs, hosts on most meeting slots, and follows between members. Development only.
#
#   bin/rails demo:seed    # idempotent; draws the pictures first (needs python3 + Pillow)
#   bin/rails demo:reset   # removes everything demo:seed made
#
# Then run the server with ADMIN_EMAILS=sam.okafor@demo.example.com so Sam is a site admin,
# and pick who to be at /dev/users (Dev::LoginsController, development only).
module DemoKit
  DOMAIN = "demo.example.com"
  PASSWORD = "demo-pass-123"
  ASSETS = Rails.root.join("tmp/demo_assets")

  # days: 0 = Sunday .. 6 = Saturday. at: "HH:MM". mins: length.
  EVERY = (0..6).to_a
  GROUPS = [
    { slug: "sunrise-serenity", title: "Sunrise Serenity", short: "Sunrise", tz: "America/Phoenix", a: "#ff9a3c", b: "#e0457b", symbol: "sun", scene: "sunrise",
      description: "Four meetings a day, every day, in the same hall. Walk in at six in the morning or last thing at night; there's always a chair.",
      place: "Serenity Hall", remote: false,
      meetings: [
        { days: EVERY, at: "06:00", mins: 60, name: "Early Birds", types: %w[O D] },
        { days: EVERY, at: "12:00", mins: 60, name: "Noon Reflections", types: %w[O DR ONL], online: true },
        { days: EVERY, at: "17:30", mins: 75, name: "Back Porch Big Book", types: %w[O B] },
        { days: EVERY, at: "20:00", mins: 60, name: "Night Cap", types: %w[C D] },
      ] },
    { slug: "sunday-night-lights", title: "Sunday Night Lights", short: "Sunday", tz: "America/Chicago", a: "#3a2a8c", b: "#1b8fd6", symbol: "moon", scene: "night",
      description: "One meeting a week, and it's a speaker. Sunday at seven, with cookies, to get us ready for Monday.",
      place: "Elm Street Community Center", remote: false,
      meetings: [{ days: [0], at: "19:00", mins: 90, name: "Sunday Night Lights", types: %w[O SP] }] },
    { slug: "lakeside-big-book-study", title: "Lakeside Big Book Study", short: "Lakeside", tz: "America/New_York", a: "#1d7a8c", b: "#2c4a9a", symbol: "book", scene: "lake",
      description: "We read the book out loud, a page at a time, and talk about what it says to us. Newcomers get a copy.",
      place: "Lakeside Library, Meeting Room B", remote: false,
      meetings: [
        { days: [2, 4], at: "18:30", mins: 75, name: "Lakeside Big Book Study", types: %w[B O] },
        { days: [6], at: "08:00", mins: 60, name: "Saturday Coffee & Steps", types: %w[ST O] },
      ] },
    { slug: "desert-rose-womens-group", title: "Desert Rose Women's Group", short: "Desert Rose", tz: "America/Phoenix", a: "#e8587a", b: "#b8337a", symbol: "rose", scene: "desert",
      description: "A women's group that has met since before most of us got here. Childcare on Wednesdays.",
      place: "Desert Rose Clubhouse", remote: false,
      meetings: [
        { days: [3], at: "10:00", mins: 60, name: "Desert Rose Morning", types: %w[W D O CF] },
        { days: [6], at: "09:00", mins: 75, name: "Desert Rose Step Study", types: %w[W ST] },
        { days: [1], at: "19:00", mins: 60, name: "Rose Online", types: %w[W D ONL], online: true },
      ] },
    { slug: "pine-ridge-stag", title: "Pine Ridge Stag", short: "Pine Ridge", tz: "America/Denver", a: "#2f7d4f", b: "#1c4f6b", symbol: "pine", scene: "pines",
      description: "A men's stag meeting in the foothills. Closed discussion, strong coffee, no cross talk.",
      place: "Pine Ridge Grange Hall", remote: false,
      meetings: [{ days: [1, 5], at: "19:00", mins: 60, name: "Pine Ridge Stag", types: %w[M C D] }] },
    { slug: "harbor-light-online", title: "Harbor Light Online", short: "Harbor", tz: "America/Los_Angeles", a: "#1aa6b7", b: "#274b9f", symbol: "lighthouse", scene: "harbor",
      description: "Online only: a quiet meditation meeting at dawn and a talking meeting at night, every day, for people who are up when no one else is.",
      place: "Online", remote: true,
      meetings: [
        { days: EVERY, at: "06:00", mins: 45, name: "Lighthouse Early Watch", types: %w[ONL O MED], online: true },
        { days: EVERY, at: "21:00", mins: 60, name: "Harbor Night Watch", types: %w[ONL O D], online: true },
      ] },
    { slug: "second-chances-young-people", title: "Second Chances", short: "2nd Chances", tz: "America/Chicago", a: "#8a3ffc", b: "#ff5fa2", symbol: "star", scene: "city",
      description: "Young people's meetings: Tuesday is a newcomer night, Thursday and Saturday are the big ones. Pizza is a recovery tool.",
      place: "Third Avenue Rec Center", remote: false,
      meetings: [
        { days: [2], at: "19:00", mins: 60, name: "Newcomer Night", types: %w[BE Y O] },
        { days: [4, 6], at: "20:00", mins: 75, name: "Second Chances", types: %w[Y D O] },
      ] },
    { slug: "hilltop-step-study", title: "Hilltop Step Study", short: "Hilltop", tz: "America/New_York", a: "#7a5af8", b: "#2b6cb0", symbol: "steps", scene: "hill",
      description: "A step meeting midweek, a speaker on Sunday morning, and a potluck with birthdays on the first Saturday that turns into every Saturday.",
      place: "Hilltop United Hall", remote: false,
      meetings: [
        { days: [3], at: "19:00", mins: 75, name: "Hilltop Step Study", types: %w[ST O] },
        { days: [0], at: "10:00", mins: 75, name: "Hilltop Speaker Meeting", types: %w[SP O] },
        { days: [6], at: "18:00", mins: 90, name: "Potluck & Birthdays", types: %w[H O] },
      ] },
  ].freeze

  # name => look (hair: short curly long bob bun bald cap), years sober, bio
  PEOPLE = {
    "Maya Brooks" => { hair: "bun", glasses: true, years: 6.4, bio: "Group secretary at Sunrise. Coffee first, minutes second." },
    "Dev Patel" => { hair: "short", years: 3.2, bio: "Treasurer. I count the basket twice and the days once." },
    "Linda Kowalski" => { hair: "bob", glasses: true, years: 14.8, bio: "Sunday Night Lights secretary and Sunrise record keeper. Fourteen years and still learning." },
    "Marcus Johnson" => { hair: "short", beard: true, years: 9.1, bio: "Hosts the noon meeting. Ask me about sponsorship." },
    "Sofia Alvarez" => { hair: "long", years: 2.5, bio: "Host coordinator. If your slot's open, I'll find you." },
    "Tom Nguyen" => { hair: "cap", years: 1.3, bio: "Newer here, always early to set up chairs." },
    "Priya Raman" => { hair: "long", years: 4.0, bio: "Night Cap regular. Tea, not coffee." },
    "Grace Whitfield" => { hair: "curly", glasses: true, years: 0.4, bio: "Just found this app and these rooms." },
    "Jack O'Malley" => { hair: "short", beard: true, years: 11.7, bio: "Speaker meetings are my favorite kind of church." },
    "Aisha Bello" => { hair: "bun", years: 5.3, bio: "Treasurer at Sunday Night Lights. Receipts in a binder." },
    "Carlos Mendoza" => { hair: "curly", beard: true, years: 7.0, bio: "Brings the cookies on Sunday." },
    "Hannah Lindqvist" => { hair: "long", glasses: true, years: 8.6, bio: "Big Book nerd. Lakeside secretary." },
    "Eddie Washington" => { hair: "bald", beard: true, years: 19.2, bio: "Nineteen years. Treasurer, tea-maker, tradition-quoter." },
    "Rosa Delgado" => { hair: "bob", years: 12.4, bio: "Desert Rose secretary. Wednesday mornings are sacred." },
    "Ben Katz" => { hair: "curly", glasses: true, years: 3.8, bio: "Hosts and treasurer on the Hilltop. Mostly hosts." },
    "Yuki Tanaka" => { hair: "bob", years: 2.0, bio: "Coordinates hosts for Desert Rose." },
    "Frank Dubois" => { hair: "bald", beard: true, glasses: true, years: 22.5, bio: "Pine Ridge secretary. Stag since forever." },
    "Gloria Okonkwo" => { hair: "bun", glasses: true, years: 1.0, bio: "One year in September." },
    "Omar Haddad" => { hair: "short", beard: true, years: 6.0, bio: "Pine Ridge treasurer." },
    "Tessa Bloom" => { hair: "curly", years: 4.6, bio: "Gardener, Desert Rose host." },
    "Walter Greene" => { hair: "bald", glasses: true, years: 25.3, bio: "Hilltop secretary. Has outlasted three coffee makers." },
    "Nina Petrov" => { hair: "long", years: 3.3, bio: "Online and in person, whichever comes first." },
    "Raj Malhotra" => { hair: "short", glasses: true, years: 5.5, bio: "Treasurer for Harbor Light. Spreadsheets, but the friendly kind." },
    "Betty Sullivan" => { hair: "bob", glasses: true, years: 17.9, bio: "Desert Rose treasurer. Knits during the readings." },
    "Luis Ortega" => { hair: "cap", beard: true, years: 2.8, bio: "Harbor Light night owl." },
    "Zoe Chen" => { hair: "bun", years: 4.4, bio: "Harbor Light secretary and host coordinator." },
    "Calvin Reed" => { hair: "short", years: 1.7, bio: "Pine Ridge host. Drives forty minutes each way and says it's worth it." },
    "Imani Carter" => { hair: "curly", years: 2.2, bio: "Second Chances secretary." },
    "Pete Novak" => { hair: "cap", beard: true, years: 8.0, bio: "Stag and young people's both. Old guy, young heart." },
    "Dana Fischer" => { hair: "long", years: 1.9, bio: "Newcomer Night host." },
    "Jordan Ellis" => { hair: "short", glasses: true, years: 0.9, bio: "Twenty-three and nine months in." },
    "Kai Morales" => { hair: "curly", years: 1.4, bio: "Second Chances, Thursday regular." },
    "Sam Okafor" => { hair: "short", beard: true, glasses: true, years: 10.0, bio: "Site admin for the demo.", site_admin: true },
  }.freeze

  # group slug => [[name, role, flags...]]; flags: keeper treasury schedule host requested
  MEMBERS = {
    "sunrise-serenity" => [["Maya Brooks", "admin", :keeper, :schedule, :host], ["Dev Patel", "admin", :treasury, :host], ["Linda Kowalski", "member", :keeper],
                           ["Marcus Johnson", "member", :host], ["Sofia Alvarez", "member", :schedule, :host], ["Tom Nguyen", "member", :host],
                           ["Priya Raman", "member", :host], ["Grace Whitfield", "member", :requested]],
    "sunday-night-lights" => [["Linda Kowalski", "admin", :keeper, :host], ["Jack O'Malley", "member", :host], ["Aisha Bello", "member", :keeper, :treasury],
                              ["Carlos Mendoza", "member", :host], ["Maya Brooks", "member"]],
    "lakeside-big-book-study" => [["Hannah Lindqvist", "admin", :keeper, :schedule, :host], ["Eddie Washington", "admin", :treasury, :host], ["Ben Katz", "member", :host],
                                  ["Walter Greene", "member", :host], ["Tom Nguyen", "member"], ["Rosa Delgado", "member"]],
    "desert-rose-womens-group" => [["Rosa Delgado", "admin", :keeper, :host], ["Betty Sullivan", "admin", :treasury, :host], ["Yuki Tanaka", "member", :schedule, :host],
                                   ["Tessa Bloom", "member", :host], ["Nina Petrov", "member"], ["Imani Carter", "member", :requested]],
    "pine-ridge-stag" => [["Frank Dubois", "admin", :keeper, :schedule, :host], ["Omar Haddad", "admin", :treasury, :host], ["Calvin Reed", "member", :host],
                          ["Pete Novak", "member", :host], ["Raj Malhotra", "member"], ["Marcus Johnson", "member"]],
    "harbor-light-online" => [["Zoe Chen", "admin", :keeper, :schedule, :host], ["Raj Malhotra", "admin", :treasury, :host], ["Dana Fischer", "member", :host],
                              ["Luis Ortega", "member", :host], ["Aisha Bello", "member", :host], ["Nina Petrov", "member", :host]],
    "second-chances-young-people" => [["Imani Carter", "admin", :keeper, :schedule, :host], ["Luis Ortega", "admin", :treasury], ["Dana Fischer", "member", :host],
                                      ["Carlos Mendoza", "member"], ["Tessa Bloom", "member", :keeper], ["Jordan Ellis", "member", :host],
                                      ["Kai Morales", "member", :host], ["Pete Novak", "member"]],
    "hilltop-step-study" => [["Walter Greene", "admin", :keeper, :host], ["Ben Katz", "admin", :treasury, :schedule, :host], ["Betty Sullivan", "member"],
                             ["Gloria Okonkwo", "member", :host], ["Hannah Lindqvist", "member"], ["Jordan Ellis", "member", :host]],
  }.freeze

  # The two books the readings come from, imported with the app's own importer from files already in the repo
  BOOKS = [
    { file: "db/imports/bigbook-4e.json", work_key: "bigbook", cover_color: "blue" },
    { file: "db/imports/twelve-twelve.json", work_key: "twelve_and_twelve", cover_color: "violet" },
  ].freeze

  # Each reading is cut from a chapter: [opening words of a paragraph, how many paragraphs from there]
  READINGS = [
    { title: "How It Works", book: "bigbook", chapter: "how-it-works", source: "Alcoholics Anonymous (the Big Book), chapter 5",
      cut: [["Rarely have we seen", 3], ["Here are the steps we took", 14]], group: "sunrise-serenity", by: "Maya Brooks", meeting: "Early Birds", tags: ["Big Book", "The Steps"] },
    { title: "We Agnostics: Your Own Conception of God", book: "bigbook", chapter: "we-agnostics", source: "Alcoholics Anonymous (the Big Book), chapter 4",
      cut: [["Much to our relief", 3]], group: "lakeside-big-book-study", by: "Hannah Lindqvist", meeting: "Lakeside Big Book Study", tags: ["Big Book", "Step 2", "Step 3"] },
    { title: "A Vision for You", book: "bigbook", chapter: "a-vision-for-you", source: "Alcoholics Anonymous (the Big Book), chapter 11",
      cut: [["Yes, there is a substitute", 4]], group: "sunday-night-lights", by: "Linda Kowalski", meeting: "Sunday Night Lights", tags: ["Big Book", "Fellowship"] },
    { title: "The Promises", book: "bigbook", chapter: "into-action", source: "Alcoholics Anonymous (the Big Book), chapter 6",
      cut: [["If we are painstaking", 3]], group: "sunrise-serenity", by: "Maya Brooks", meeting: "Back Porch Big Book", tags: ["Big Book", "Step 9"] },
    { title: "Step One", book: "twelve_and_twelve", chapter: "step-one", source: "Twelve Steps and Twelve Traditions, Step One",
      cut: [["“We admitted we were powerless", 1], ["WHO cares to admit", 3]], group: "second-chances-young-people", by: "Imani Carter", meeting: "Newcomer Night", tags: ["Twelve and Twelve", "Step 1"] },
    { title: "Step Three", book: "twelve_and_twelve", chapter: "step-three", source: "Twelve Steps and Twelve Traditions, Step Three",
      cut: [["“Made a decision to turn", 1], ["PRACTICING Step Three", 2]], group: "hilltop-step-study", by: "Walter Greene", meeting: "Hilltop Step Study", tags: ["Twelve and Twelve", "Step 3"] },
    { title: "Step Seven: Humility", book: "twelve_and_twelve", chapter: "step-seven", source: "Twelve Steps and Twelve Traditions, Step Seven",
      cut: [["SINCE this Step so specifically", 3]], group: "lakeside-big-book-study", by: "Hannah Lindqvist", meeting: "Saturday Coffee & Steps", tags: ["Twelve and Twelve", "Step 7"] },
    { title: "Step Eleven: The Prayer of St. Francis", book: "twelve_and_twelve", chapter: "step-eleven", source: "Twelve Steps and Twelve Traditions, Step Eleven",
      cut: [["Well, we might start like this", 4]], group: "harbor-light-online", by: "Zoe Chen", meeting: "Lighthouse Early Watch", tags: ["Twelve and Twelve", "Step 11", "Meditation"] },
    { title: "Step Twelve: The Joy of Living", book: "twelve_and_twelve", chapter: "step-twelve", source: "Twelve Steps and Twelve Traditions, Step Twelve",
      cut: [["THE joy of living", 2]], group: "desert-rose-womens-group", by: "Rosa Delgado", meeting: "Desert Rose Morning", tags: ["Twelve and Twelve", "Step 12"] },
    { title: "Tradition Five: One Primary Purpose", book: "twelve_and_twelve", chapter: "tradition-five", source: "Twelve Steps and Twelve Traditions, Tradition Five",
      cut: [["Alcoholics Anonymous can be likened", 2]], group: "pine-ridge-stag", by: "Frank Dubois", meeting: "Pine Ridge Stag", tags: ["Twelve and Twelve", "Traditions"] },
  ].freeze

  # What earns chips: 10th step inventories and gratitude lists (triangles), meeting joins
  # (Meeting Maker) and round chips a group's hosts gave (claimed at once)
  ENTRIES = { "Maya Brooks" => { gratitude: 35, inventory: 8 }, "Dev Patel" => { gratitude: 9 }, "Linda Kowalski" => { inventory: 31 }, "Tom Nguyen" => { gratitude: 7 },
              "Hannah Lindqvist" => { inventory: 12, gratitude: 30 }, "Jordan Ellis" => { gratitude: 8 } }.freeze
  JOINS = { "Tom Nguyen" => ["sunrise-serenity", "Early Birds", 12], "Luis Ortega" => ["harbor-light-online", "Harbor Night Watch", 6],
            "Marcus Johnson" => ["sunrise-serenity", "Noon Reflections", 26], "Walter Greene" => ["hilltop-step-study", "Hilltop Step Study", 5] }.freeze
  AWARDS = [["sunrise-serenity", "Maya Brooks", "Tom Nguyen", "year", 1, "One year. We're proud of you."], ["sunday-night-lights", "Linda Kowalski", "Carlos Mendoza", "year", 7, "Seven years of cookies and courage."],
            ["hilltop-step-study", "Walter Greene", "Jordan Ellis", "9m", nil, "Nine months! Keep coming back."], ["second-chances-young-people", "Imani Carter", "Kai Morales", "year", 1, "A year at twenty-two. Wow."],
            ["desert-rose-womens-group", "Rosa Delgado", "Yuki Tanaka", "year", 2, "Two years of Wednesdays."], ["harbor-light-online", "Zoe Chen", "Luis Ortega", "year", 2, "Two years, one night watch at a time."]].freeze

  # Timeline posts. key lets reposts point at one; chip is a chip id (or "award", "meeting:25"); to is whose page it is on.
  # vis: public (shown as Members), followers or private. ago: days. react: name => like/love/hugs. say: [[name, comment]].
  NOTES = [
    { key: :chairs, by: "Tom Nguyen", vis: "public", groups: %w[sunrise-serenity], ago: 2.1, react: { "Maya Brooks" => "love", "Dev Patel" => "like", "Priya Raman" => "hugs", "Linda Kowalski" => "love" },
      say: [["Maya Brooks", "Look at you. Proud of you, Tom. See you at Early Birds."], ["Marcus Johnson", "Chairs AND coffee? You're getting promoted to secretary."]],
      body: "A year and change ago I couldn't sit through a whole meeting. Tonight I set up the chairs, made the coffee, and read the Steps. #grateful #oneday" },
    { key: :coffee, by: "Maya Brooks", vis: "public", groups: %w[sunrise-serenity sunday-night-lights], images: %w[coffee], ago: 3.4, react: { "Linda Kowalski" => "like", "Dev Patel" => "like", "Carlos Mendoza" => "love" },
      body: "Secretary's report: the coffee maker survived another week. Minutes are posted, and come hungry on Sunday. @linda-kowalski @dev-patel #fellowship" },
    { key: :hike, by: "Hannah Lindqvist", vis: "public", groups: %w[lakeside-big-book-study], images: %w[hike], ago: 4.2, react: { "Eddie Washington" => "love", "Ben Katz" => "like", "Tom Nguyen" => "hugs" },
      say: [["Eddie Washington", "Nobody talked about Step Four for a whole hour. A record."]],
      body: "Saturday sunrise hike with the Lakeside crowd. Nobody mentioned Step Four for a full hour, which may be a record. #oneday #fellowship" },
    { key: :potluck, by: "Rosa Delgado", vis: "public", groups: %w[desert-rose-womens-group], images: %w[potluck], ago: 5.3, react: { "Betty Sullivan" => "love", "Yuki Tanaka" => "like", "Tessa Bloom" => "love", "Nina Petrov" => "like" },
      say: [["Betty Sullivan", "The green chile casserole is now officially a Desert Rose tradition."]],
      body: "Potluck after Wednesday morning. The casserole table went three deep. #fellowship #grateful" },
    { key: :cake, by: "Jordan Ellis", vis: "public", groups: %w[hilltop-step-study second-chances-young-people], images: %w[cake], ago: 6.0, react: { "Walter Greene" => "love", "Kai Morales" => "hugs", "Ben Katz" => "like" },
      body: "Nine months today! My sponsor made a cake shaped like a chip and I ate the chip first. #9months #grateful" },
    { key: :five_k, by: "Kai Morales", vis: "public", groups: %w[second-chances-young-people], images: %w[finish-line], ago: 1.2, react: { "Imani Carter" => "love", "Dana Fischer" => "love", "Jordan Ellis" => "hugs", "Pete Novak" => "like" },
      say: [["Imani Carter", "Last place with a huge grin is the best place. Pizza on me."], ["Pete Novak", "Proud of you, kid."]],
      body: "Ran my first 5K this morning. Last place, huge grin. A year ago I couldn't climb the stairs without stopping. #oneday" },
    { key: :job, by: "Dana Fischer", vis: "public", groups: %w[second-chances-young-people harbor-light-online], ago: 7.5, react: { "Zoe Chen" => "love", "Luis Ortega" => "love", "Imani Carter" => "hugs" },
      body: "New job starts Monday. First time in six years I'm excited about a Monday. Thank you for the rides, the phone calls and the pep talks. #grateful" },
    { key: :urn, by: "Frank Dubois", vis: "followers", groups: %w[pine-ridge-stag], ago: 8.0, react: { "Omar Haddad" => "like", "Pete Novak" => "like" },
      body: "Pine Ridge Stag has a new coffee urn. Closed meeting, strong coffee, no crosstalk. The urn did not need a motion." },
    { key: :keys, by: "Luis Ortega", vis: "public", groups: %w[harbor-light-online second-chances-young-people], images: %w[keys], ago: 4.8, react: { "Zoe Chen" => "love", "Raj Malhotra" => "love", "Dana Fischer" => "hugs", "Imani Carter" => "love" },
      say: [["Zoe Chen", "Housewarming at Harbor Night Watch. Everyone bring a plant."]],
      body: "Got the keys to my own place today. Two years ago I was on a friend's couch counting days on my fingers. #2years #grateful" },
    { key: :birthday, by: "Pete Novak", vis: "followers", groups: %w[pine-ridge-stag second-chances-young-people], ago: 9.1, react: { "Frank Dubois" => "like", "Kai Morales" => "love" },
      body: "Eight years on Friday. I'm throwing a very small party: me, a cake, and whoever shows up to the Stag. #8years" },
    { key: :coffee_date, by: "Aisha Bello", vis: "private", groups: %w[sunday-night-lights], ago: 10.0, react: { "Linda Kowalski" => "like" },
      body: "Reminder for Sunday Night Lights: treasurer's report is in the binder, and the basket total was up this month. #fellowship" },
    # chips
    { key: :six_years, by: "Maya Brooks", vis: "public", groups: %w[sunrise-serenity sunday-night-lights], chip: "round:year-6", ago: 0.6, react: { "Tom Nguyen" => "love", "Linda Kowalski" => "love", "Dev Patel" => "love", "Sofia Alvarez" => "hugs", "Priya Raman" => "love" },
      say: [["Tom Nguyen", "Six years! You're why I came back the second time."], ["Linda Kowalski", "Proud of you, sister."]], body: "Six years. Still one day at a time." },
    { key: :one_year, by: "Tom Nguyen", vis: "public", groups: %w[sunrise-serenity], chip: "award", ago: 12.0, react: { "Maya Brooks" => "hugs", "Marcus Johnson" => "love", "Sofia Alvarez" => "love" },
      body: "My group gave me my one-year chip. I didn't cry. I cried. #1year" },
    { key: :streak, by: "Hannah Lindqvist", vis: "public", groups: %w[lakeside-big-book-study], chip: "gratitude-streak:30", ago: 2.6, react: { "Ben Katz" => "like", "Eddie Washington" => "love" },
      body: "Thirty days of gratitude lists in a row. Some days it was just coffee, the dog and a green light. It counts. #grateful" },
    { key: :tenth, by: "Linda Kowalski", vis: "public", groups: %w[sunday-night-lights sunrise-serenity], chip: "inventory-streak:30", ago: 3.0, react: { "Maya Brooks" => "love", "Jack O'Malley" => "like", "Carlos Mendoza" => "like" },
      body: "Thirty nights in a row of 10th step. It isn't glamorous. It's maintenance, and it works. #step10" },
    { key: :meeting_maker, by: "Marcus Johnson", vis: "public", groups: %w[sunrise-serenity], chip: "meeting:25", ago: 5.0, react: { "Sofia Alvarez" => "like", "Tom Nguyen" => "like", "Dev Patel" => "love" },
      body: "25 times through the door at Noon Reflections. Showing up is the whole program." },
    { key: :luis_two, by: "Luis Ortega", vis: "public", groups: %w[harbor-light-online], chip: "award", ago: 11.0, react: { "Zoe Chen" => "love", "Raj Malhotra" => "love", "Nina Petrov" => "hugs" },
      body: "Two years from Harbor Light. Thank you, Zoe. #2years" },
    { key: :kai_year, by: "Kai Morales", vis: "public", groups: %w[second-chances-young-people], chip: "award", ago: 13.0, react: { "Imani Carter" => "love", "Dana Fischer" => "love", "Jordan Ellis" => "love" },
      body: "One year. @imani-carter gave it to me at Newcomer Night. It lives in my pocket now. #1year" },
    { key: :seven, by: "Carlos Mendoza", vis: "public", groups: %w[sunday-night-lights], chip: "award", ago: 14.0, react: { "Linda Kowalski" => "love", "Jack O'Malley" => "love" },
      body: "Seven years, and the cookies are still free. #7years" },
    { key: :twenty_five, by: "Walter Greene", vis: "public", groups: %w[hilltop-step-study lakeside-big-book-study], chip: "round:year-25", ago: 15.0, react: { "Ben Katz" => "love", "Hannah Lindqvist" => "love", "Betty Sullivan" => "love", "Jordan Ellis" => "hugs", "Gloria Okonkwo" => "love" },
      say: [["Hannah Lindqvist", "A man in a Wednesday step study once told you it would work. He was right."]],
      body: "Twenty-five years. I don't say it to brag. A man in a Wednesday step study told me it would work if I let it. It did. Keep coming back. #25years" },
  ].freeze

  # Notes written on someone else's page (they follow each other)
  PAGE_NOTES = [
    { by: "Maya Brooks", to: "Tom Nguyen", vis: "followers", ago: 1.9, body: "Proud of you for the chairs AND the Steps, Tom. Coffee Tuesday? #fellowship" },
    { by: "Imani Carter", to: "Kai Morales", vis: "public", ago: 12.5, body: "Happy one year, Kai! Pizza is on me Saturday. #1year" },
    { by: "Walter Greene", to: "Jordan Ellis", vis: "public", ago: 5.8, body: "Nine months already? You earned that chip, Jordan." },
    { by: "Zoe Chen", to: "Luis Ortega", vis: "public", ago: 4.5, body: "Congratulations on the keys, Luis. Housewarming at Harbor Night Watch? Bring snacks." },
    { by: "Rosa Delgado", to: "Yuki Tanaka", vis: "private", ago: 6.2, body: "Thank you for covering Saturday. You make the schedule look easy." },
  ].freeze

  NOTE_REPOSTS = [["Dev Patel", :chairs, 1.8], ["Priya Raman", :coffee, 3.0], ["Marcus Johnson", :keys, 4.0], ["Sofia Alvarez", :six_years, 0.4], ["Ben Katz", :twenty_five, 14.0]].freeze

  # Highlights shared to the timeline: the quote is the paragraph's opening sentence(s)
  HIGHLIGHTS = [
    { key: :h_rarely, by: "Maya Brooks", book: "bigbook", chapter: "how-it-works", starts: "Rarely have we seen", sentences: 1, color: "yellow", vis: "public", ago: 3.2,
      note: "Read this at Early Birds today and it still lands. #bigbook", react: { "Dev Patel" => "love", "Tom Nguyen" => "like", "Linda Kowalski" => "love" } },
    { key: :h_relief, by: "Hannah Lindqvist", book: "bigbook", chapter: "we-agnostics", starts: "Much to our relief", sentences: 1, color: "lime", vis: "public", ago: 4.6,
      note: "For anyone stuck on the God part: your own conception. That's the whole deal. #step3", react: { "Ben Katz" => "love", "Rosa Delgado" => "like" } },
    { key: :h_door, by: "Walter Greene", book: "twelve_and_twelve", chapter: "step-three", starts: "PRACTICING Step Three", sentences: 1, color: "cyan", vis: "public", ago: 5.6,
      note: "Hilltop tonight: this paragraph. A door that looks closed and isn't. #step3", react: { "Jordan Ellis" => "love", "Betty Sullivan" => "like" } },
    { key: :h_defeat, by: "Imani Carter", book: "twelve_and_twelve", chapter: "step-one", starts: "WHO cares to admit", sentences: 2, color: "pink", vis: "public", ago: 2.4,
      note: "Newcomer Night opener. Nobody wants to admit defeat, and that's exactly why it works. #step1", react: { "Kai Morales" => "love", "Dana Fischer" => "hugs", "Jordan Ellis" => "like" } },
    { key: :h_prayer, by: "Zoe Chen", book: "twelve_and_twelve", chapter: "step-eleven", starts: "PRAYER and meditation are our principal", sentences: 1, color: "orange", vis: "public", ago: 6.6,
      note: "Early watch reading. Eleven minutes of quiet beats eleven hours of noise. #step11 #meditation", react: { "Luis Ortega" => "love", "Nina Petrov" => "love" } },
    { key: :h_substitute, by: "Kai Morales", book: "bigbook", chapter: "a-vision-for-you", starts: "Yes, there is a substitute", sentences: 2, color: "yellow", vis: "public", ago: 8.4,
      note: "This is what showed up for me: a fellowship. #bigbook", react: { "Imani Carter" => "love", "Pete Novak" => "like" } },
  ].freeze

  HIGHLIGHT_REPOSTS = [["Dev Patel", :h_rarely, 3.0], ["Tom Nguyen", :h_relief, 4.0], ["Luis Ortega", :h_prayer, 6.0], ["Jordan Ellis", :h_defeat, 2.0]].freeze

  module_function

  def email(name) = "#{name.parameterize(separator: '.')}@#{DOMAIN}"
  def username(name) = name.parameterize

  def guard!
    abort "demo tasks only run in development" unless Rails.env.development?
  end

  def draw_images
    FileUtils.mkdir_p(ASSETS)
    spec = {
      groups: GROUPS.map { |g| g.slice(:slug, :short, :a, :b, :symbol, :scene) },
      people: PEOPLE.map { |n, p| { username: username(n), hair: p[:hair], beard: !!p[:beard], glasses: !!p[:glasses] } },
      photos: %w[finish-line keys cake hike potluck coffee],
    }
    File.write(ASSETS.join("spec.json"), JSON.pretty_generate(spec))
    system("python3", Rails.root.join("script/demo/make_images.py").to_s, ASSETS.to_s) || abort("could not draw the pictures (python3 + Pillow needed)")
  end

  def attach(record, name, file, type)
    return if record.public_send(name).attached?

    record.public_send(name).attach(io: File.open(file), filename: File.basename(file), content_type: type)
  end

  def make_user(name)
    p = PEOPLE.fetch(name)
    u = User.find_or_initialize_by(email: email(name))
    if u.new_record?
      u.assign_attributes(name: name, username: username(name), password: PASSWORD, password_confirmation: PASSWORD, confirmed: true, confirmed_at: Time.current)
    end
    u.bio = p[:bio]
    u.admin = true if p[:site_admin]
    u.sobriety_date = (Date.current - (p[:years] * 365).to_i)
    u.show_sobriety_date = p[:years] > 5
    u.save!
    attach(u, :avatar, ASSETS.join("avatar-#{username(name)}.jpg"), "image/jpeg")
    u
  end

  def make_group(spec, users)
    g = Group.find_or_initialize_by(slug: spec[:slug])
    g.assign_attributes(title: spec[:title], description: spec[:description], time_zone: spec[:tz], location: spec[:place], remote: spec[:remote],
                        meetingLink: (spec[:remote] ? "https://example.com/#{spec[:slug]}" : nil), status: "active",
                        created_by: users.fetch(MEMBERS.fetch(spec[:slug]).first.first))
    g.save!
    attach(g, :cover, ASSETS.join("cover-#{spec[:slug]}.jpg"), "image/jpeg")
    attach(g, :logo, ASSETS.join("logo-#{spec[:slug]}.png"), "image/png")
    g
  end

  def make_members(group, users)
    MEMBERS.fetch(group.slug).each do |name, role, *flags|
      m = group.memberships.find_or_initialize_by(user: users.fetch(name))
      m.assign_attributes(role: role, status: flags.include?(:requested) ? "requested" : "active", can_keep_records: flags.include?(:keeper),
                          can_keep_treasury: flags.include?(:treasury), can_schedule_hosts: flags.include?(:schedule),
                          can_host: flags.include?(:host) || role == "admin")
      m.save!
    end
  end

  def make_meetings(group, spec)
    return if group.meetings.exists?

    spec[:meetings].each do |m|
      h, min = m[:at].split(":").map(&:to_i)
      m[:days].each do |day|
        group.meetings.create!(name: m[:name], recurrence: "weekly", day_of_week: day, start_minute: h * 60 + min, end_minute: h * 60 + min + m[:mins],
                               time_zone: spec[:tz], types: m[:types], location: m[:online] && spec[:remote] ? nil : spec[:place],
                               conference_url: m[:online] ? "https://example.com/#{spec[:slug]}/#{m[:name].parameterize}" : nil)
      end
    end
  end

  # Most places filled, a few left open so the open-places flags have something to show
  def make_hosts(group, users)
    pool = group.memberships.active.where(can_host: true).includes(:user).map(&:user)
    return if pool.empty? || MeetingHost.joins(:meeting).where(meetings: { group_id: group.id }).exists?

    rng = Random.new(group.id)
    group.meetings.weekly.ordered.each_with_index do |meeting, i|
      { "host" => 0.8, "co_host" => 0.4 }.each do |role, odds|
        next if rng.rand > odds

        who = pool[(i + (role == "host" ? 0 : 1)) % pool.size]
        meeting.hosts.create!(role: role, user: who, name: who.display_name, starts_on: Date.current - 45)
      end
    end
  end

  def import_books
    BOOKS.map do |b|
      book = Book.find_by(work_key: b[:work_key])
      book ||= LiteratureJsonImporter.import!(Rails.root.join(b[:file]).to_s).book
      book.update!(publicly_accessible: true, members_only: false, cover_color: book.cover_color || b[:cover_color])
      book
    end
  end

  # The chapter's paragraphs as plain text, with the PDF's stray one-character lines dropped
  def paragraphs(chapter) = chapter.content.to_s.split("\n\n").map(&:squish).reject { |p| p.length < 4 }

  def excerpt(chapter, cut)
    paras = paragraphs(chapter)
    cut.flat_map do |phrase, count|
      i = paras.index { |p| p.start_with?(phrase) } or raise "no paragraph starting #{phrase.inspect} in #{chapter.slug}"
      paras[i, count]
    end
  end

  def make_readings(users, groups, books)
    by_key = books.index_by(&:work_key)
    READINGS.each_with_index do |r, i|
      chapter = by_key.fetch(r[:book]).chapters.find_by!(slug: r[:chapter])
      group = groups.fetch(r[:group])
      reading = Reading.find_or_initialize_by(title: r[:title], group: group)
      next if reading.persisted?

      html = excerpt(chapter, r[:cut]).map { |t| "<p>#{ERB::Util.html_escape(t)}</p>" }.join
      reading.assign_attributes(user: users.fetch(r[:by]), source: r[:source], meetingName: r[:meeting], host: r[:by],
                                content: html, published_at: Time.current - (i + 1).days)
      reading.tags = r[:tags].map { |t| Tag.find_or_create_by!(title: t) }
      reading.save!
    end
  end

  # Every group has both books in its literature
  def make_group_books(groups, books)
    groups.each_value do |group|
      books.each { |book| GroupBook.find_or_create_by!(group: group, book: book) { |gb| gb.note = "Approved by our group conscience" } }
    end
  end

  def make_chip_fuel(users, groups)
    ENTRIES.each do |name, kinds|
      user = users.fetch(name)
      kinds.each do |kind, n|
        model = kind == :inventory ? StepInventory : GratitudeList
        next if model.where(user: user).count >= n

        n.times do |i|
          day = Date.current - 1 - i
          if kind == :inventory then model.find_or_create_by!(user: user, on: day) { |e| e.notes = "" }
          else model.find_or_create_by!(user: user, on: day) { |e| e.items = ["my sponsor", "coffee", "a quiet morning"] }
          end
        end
      end
    end
    JOINS.each do |name, (slug, meeting_name, n)|
      user = users.fetch(name)
      meeting = groups.fetch(slug).meetings.weekly.find_by!(name: meeting_name)
      next if MeetingJoin.where(user: user, meeting: meeting).count >= n

      n.times { |i| MeetingJoin.find_or_create_by!(user: user, meeting: meeting, starts_at: (Time.current - (i + 1).days).change(hour: 12)) }
    end
    AWARDS.each do |slug, by, to, key, years, note|
      next if ChipAward.exists?(group: groups.fetch(slug), user: users.fetch(to), milestone_key: key, years: years)

      ChipAward.create!(group: groups.fetch(slug), given_by: users.fetch(by), user: users.fetch(to), email: users.fetch(to).email, milestone_key: key, years: years,
                        on: Date.current - 20, note: note, claimed_at: Time.current - 19.days)
    end
    # already celebrated, so nobody gets the confetti popup the first time they sign in
    ChipAward.where(group_id: groups.values.map(&:id), celebrated_at: nil).update_all(celebrated_at: Time.current - 18.days)
  end

  def backdate(record, days)
    t = Time.current - days.days
    record.update_columns(created_at: t, updated_at: t)
  end

  def chip_id_for(user, want)
    ids = Chips.catalog(user)[:chips].map { |c| c[:id].to_s }
    case want
    when "award" then ids.find { |id| id.start_with?("award:") }
    when /\Ameeting:(\d+)\z/ then ids.find { |id| id.match?(/\Ameeting-\d+:#{Regexp.last_match(1)}\z/) }
    else want
    end
  end

  def react_and_comment(record, users, react, say = [], comments_on: record)
    (react || {}).each { |name, kind| NoteReaction.find_or_create_by!(reactable: record, user: users.fetch(name)) { |r| r.kind = kind } }
    say.each do |name, text|
      comment = NoteComment.find_or_create_by!(timeline_note: comments_on, user: users.fetch(name), body: text)
      # dated after the post, and never "edited"
      comment.update_columns(created_at: record.created_at + 2.hours, updated_at: record.created_at + 2.hours)
    end
  end

  def make_notes(users, groups)
    made = {}
    NOTES.each do |n|
      author = users.fetch(n[:by])
      existing = TimelineNote.find_by(user: author, body: n[:body])
      note = existing || TimelineNote.new(user: author, body: n[:body], visibility: n[:vis])
      if note.new_record?
        if n[:chip]
          id = chip_id_for(author, n[:chip]) or raise "#{n[:by]} has no chip like #{n[:chip]}"
          note.chip = TimelineNote.chip_for(author, id, Date.current) or raise "no chip #{id} for #{n[:by]}"
          note.chip_id = note.chip["id"]
        end
        note.mentions = Mentions.resolve(n[:body], groups: [], everyone: nil)[:map]
        Array(n[:images]).each { |img| note.images.attach(io: File.open(ASSETS.join("photo-#{img}.jpg")), filename: "#{img}.jpg", content_type: "image/jpeg") }
        note.save!
        n[:groups].each { |slug| note.shares.create!(group: groups.fetch(slug)) }
        backdate(note, n[:ago])
      end
      react_and_comment(note, users, n[:react], n[:say] || [])
      made[n[:key]] = note
    end

    PAGE_NOTES.each do |n|
      author, to = users.fetch(n[:by]), users.fetch(n[:to])
      Follow.find_or_create_by!(follower: author, followed: to)
      next if TimelineNote.exists?(user: author, recipient: to, body: n[:body])

      note = TimelineNote.create!(user: author, recipient: to, body: n[:body], visibility: n[:vis])
      backdate(note, n[:ago])
    end

    NOTE_REPOSTS.each do |name, key, ago|
      original = made.fetch(key)
      next if TimelineNote.exists?(user: users.fetch(name), repost_of: original)

      backdate(TimelineNote.create!(user: users.fetch(name), repost_of: original, body: "", visibility: "public"), ago)
    end
    made
  end

  def make_highlights(users, books)
    by_key = books.index_by(&:work_key)
    made = {}
    HIGHLIGHTS.each do |h|
      author = users.fetch(h[:by])
      chapter = by_key.fetch(h[:book]).chapters.find_by!(slug: h[:chapter])
      para = chapter.content.to_s.split("\n\n").find { |p| p.strip.start_with?(h[:starts]) } or raise "no #{h[:starts].inspect} in #{chapter.slug}"
      quote = para.strip.split(/(?<=[.?!])\s+/).first(h[:sentences]).join(" ")
      start = chapter.content.index(quote) or raise "quote not found in #{chapter.slug}"
      highlight = UserHighlight.find_or_initialize_by(user: author, chapter: chapter, note: h[:note])
      if highlight.new_record?
        highlight.assign_attributes(style: { "color" => h[:color] }, visibility: h[:vis],
                                    selector: { "quote" => { "exact" => quote, "prefix" => "", "suffix" => "" }, "position" => { "start" => start, "end" => start + quote.length } })
        highlight.mentions = Mentions.resolve(h[:note], groups: [], everyone: nil)[:map]
        highlight.save!
        highlight.update_columns(created_at: Time.current - h[:ago].days, updated_at: Time.current - h[:ago].days, shared_at: Time.current - h[:ago].days)
      end
      react_and_comment(highlight, users, h[:react], [], comments_on: nil)
      made[h[:key]] = highlight
    end
    HIGHLIGHT_REPOSTS.each do |name, key, ago|
      original = made.fetch(key)
      next if TimelineNote.exists?(user: users.fetch(name), repost_of_highlight: original)

      backdate(TimelineNote.create!(user: users.fetch(name), repost_of_highlight: original, body: "", visibility: "public"), ago)
    end
  end

  def make_follows(users)
    MEMBERS.each_value do |rows|
      names = rows.reject { |r| r.include?(:requested) }.map(&:first)
      names.each_with_index do |name, i|
        names.rotate(i + 1).first(3).each do |other|
          next if other == name

          Follow.find_or_create_by!(follower: users[name], followed: users[other])
        end
      end
    end
  end
end

namespace :demo do
  desc "Make 8 fake groups, 32 fake people with cartoon pictures, meetings and hosts (development only)"
  task seed: :environment do
    DemoKit.guard!
    DemoKit.draw_images
    users = DemoKit::PEOPLE.keys.index_with { |n| DemoKit.make_user(n) }
    groups = {}
    DemoKit::GROUPS.each do |spec|
      group = groups[spec[:slug]] = DemoKit.make_group(spec, users)
      DemoKit.make_members(group, users)
      DemoKit.make_meetings(group, spec)
      DemoKit.make_hosts(group, users)
      puts "  #{group.title}: #{group.meetings.count} weekly meetings, #{group.active_memberships.count} members"
    end
    DemoKit.make_follows(users)
    DemoKit.make_chip_fuel(users, groups)
    books = DemoKit.import_books
    DemoKit.make_group_books(groups, books)
    DemoKit.make_readings(users, groups, books)
    DemoKit.make_notes(users, groups)
    DemoKit.make_highlights(users, books)
    puts "  #{TimelineNote.count} timeline posts, #{UserHighlight.on_timeline.count} shared highlights"
    puts "  #{books.map(&:title).join(' and ')} imported; #{Reading.where(group: groups.values).count} readings"
    puts "\n#{users.size} people, password for all: #{DemoKit::PASSWORD}"
    puts "Start the server as:  ADMIN_EMAILS=#{DemoKit.email('Sam Okafor')} bin/rails s"
    puts "Then open /dev/users to become any of them."
  end

  desc "Remove everything demo:seed made (development only)"
  task reset: :environment do
    DemoKit.guard!
    demo = User.where("email LIKE ?", "%@#{DemoKit::DOMAIN}").select(:id)
    TimelineNote.where(user_id: demo).destroy_all
    UserHighlight.where(user_id: demo).destroy_all
    Reading.where(user_id: User.where("email LIKE ?", "%@#{DemoKit::DOMAIN}").select(:id)).destroy_all
    Group.where(slug: DemoKit::GROUPS.map { |g| g[:slug] }).destroy_all
    User.where("email LIKE ?", "%@#{DemoKit::DOMAIN}").destroy_all
    puts "demo data removed (the imported books stay; delete them in the library if you want)"
  end
end
