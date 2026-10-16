# Sorts every Topicificator topic into one of the nine categories, adds tags and sets an
# ACID QUEST difficulty (gentle / standard / deep). Topics are matched by title, so the same
# title in any set gets the same treatment.
#
#   bin/rails topics:curate            # preview only (default)
#   bin/rails topics:curate APPLY=1    # write the changes
#
# It only fills gaps: a topic that already has a category or difficulty keeps it, and tags are
# only added, never removed. Topics on neither difficulty list get "standard". Topics it can't
# match are listed so they can be sorted by hand.
#
# Every applied run writes tmp/topic_curation_<timestamp>.json, which undoes it with:
#   bin/rails topics:undo_curate FILE=tmp/topic_curation_....json
namespace :topics do
  # code => category title, as it reads on the Categories page
  CURATION_CATEGORIES = {
    "E" => "Emotions",
    "R" => "Relationships",
    "G" => "Personal Growth",
    "S" => "Spirituality",
    "T" => "Gratitude",
    "P" => "Past Experiences",
    "C" => "Present Challenges",
    "F" => "Future & Aspirations",
    "W" => "Fellowship",
  }.freeze

  # title | category code | tags
  CURATION = <<~LIST
    Acceptance | G | Acceptance, Serenity
    Accepting My Alcoholism | P | Acceptance, Disease Concept, Newcomers
    Act As If | G | Slogans, Action
    Action | G | Action, Willingness
    Addictive Personality | C | Disease Concept, Character Defects
    Adjusting to a Sober Life | C | Newcomers, Change
    Adversity | C | Resilience
    Agnostics (We Agnostics) | S | Higher Power, Big Book, Newcomers
    We Agnostics | S | Higher Power, Big Book, Newcomers
    Amends | R | Amends, Steps
    Amends Beyond I'm Sorry | R | Amends, Steps
    Unfinished Amends | R | Amends, Steps
    Anger | E | Anger, Resentment
    Anniversaries | T | Milestones
    Celebrations in Sobriety | T | Milestones, Joy
    Sobriety Dates | T | Milestones
    Anonymity | W | Anonymity, Traditions
    Breaking My Anonymity | W | Anonymity, Traditions
    Asking for Help | W | Newcomers, Humility
    Attitude | G | Mindset
    Attraction not Promotion | W | Traditions, Service
    Attraction rather than promotion | W | Traditions, Service
    Balance | G | Self-Care, Emotional Sobriety
    Being Alone | E | Loneliness
    Being Considerate of Others | R | Service, Love
    Being Useful | W | Service
    Big Book | W | Big Book, Tools
    Boredom with the Program | C | Complacency, Relapse Prevention
    Stop Digging | P | Hitting Bottom, Slogans
    Bring the Body | W | Meetings, Slogans, Newcomers
    Bring the Body and the Mind Will Follow | W | Meetings, Slogans, Newcomers
    But For the Grace of God | T | Slogans, Higher Power
    Carry This Message | W | Service, Twelfth Step
    Carrying the Message | W | Service, Twelfth Step
    Change | G | Change
    Changing Routines | C | Change, Relapse Prevention, Newcomers
    Character Defects | G | Character Defects, Steps
    Choice | G | Willingness
    Clarity of Thought | G | Mindset
    Codependence | R | Boundaries
    Compassion | R | Love
    Complacency | C | Complacency, Relapse Prevention
    Completely Giving Myself | S | Surrender, Willingness
    Contempt | G | Open-Mindedness, Big Book
    Contempt Prior to Investigation | G | Open-Mindedness, Big Book
    Courage | E | Fear, Courage
    Courage to Change | S | Serenity Prayer, Courage, Change
    Cravings | C | Relapse Prevention, Newcomers
    Cunning, Baffling, Powerful | C | Disease Concept, Big Book
    Decision Making | G | Willingness
    Dealing | R | Boundaries, Acceptance
    Dealing with Difficult People | R | Boundaries, Acceptance
    Denial | P | Honesty, Disease Concept
    Dependence | S | Higher Power, Surrender
    Detaching | R | Boundaries, Letting Go, Love
    Disappointment | E | Expectations
    Discipline | G | Action
    Disease Concept | C | Disease Concept
    Alcoholism as a Disease | C | Disease Concept, Big Book
    Do the Next Right Thing | G | Slogans, Action
    Next Indicated Step | G | Slogans, Action
    The Doctor's Opinion | P | Big Book, Disease Concept
    Don't Drink | W | Meetings, Slogans, Newcomers
    Don't Quit | F | Hope, Slogans, Newcomers
    Drinking Occasions | C | Relapse Prevention, Triggers
    Drug is a Drug | C | Other Addictions
    Drugs | C | Other Addictions
    Drunk Who Brought You In | C | Relapse Prevention, Slogans
    Dry Drunks | C | Relapse Prevention, Emotional Sobriety
    Easy Does It | G | Slogans, Self-Care
    Economic Insecurity | C | Money, Fear
    Ego | G | Ego, Humility, Steps
    Eleventh Step Prayer | S | Prayer, Steps
    Emotional Balance | E | Emotional Sobriety, Steps
    Emotional Hangover | E | Emotional Sobriety, Steps
    Emotional Sobriety | E | Emotional Sobriety
    Enjoying Life | T | Joy
    Exact Nature of our Wrongs | P | Steps, Inventory, Honesty
    Expect a Miracle | F | Hope, Slogans
    Expectations | E | Expectations
    Experience | W | Sharing
    Experience, | W | Sharing
    Faith | S | Faith, Higher Power
    Faith without works is dead | S | Faith, Action
    Fake It Till You Make It | G | Slogans, Action
    The Family Afterwards | R | Family, Big Book
    Fear | E | Fear
    Fear of Failure | E | Fear
    Feelings and Emotions | E | Emotional Sobriety
    Feeling Different | E | Loneliness, Newcomers
    Terminal Uniqueness | E | Loneliness, Ego
    Fellowship | W | Meetings
    First Drink Gets You Drunk | C | Relapse Prevention, Slogans
    Staying Away | C | Relapse Prevention, Big Book
    Staying Away from the First Drink | C | Relapse Prevention, Big Book
    First Things First | G | Slogans, Priorities
    First Thought Wrong | G | Slogans, Mindset
    Fixing Me, Not You | G | Inventory, Boundaries
    Forgiveness | R | Forgiveness
    Forgiving Others | R | Forgiveness, Resentment
    Forgiving Ourselves | E | Forgiveness, Self-Worth
    Foundation | G | Tools
    Fourth Dimension | F | Promises, Big Book
    Freedom | F | Promises
    Freedom from Bondage | S | Prayer, Big Book, Letting Go
    Friendship | R | Friendship
    Fun | T | Joy
    Gift of Desperation | P | Hitting Bottom, Surrender
    Gifts of the Program | T | Promises
    God as I Understand Him | S | Higher Power
    God, as I Understand God | S | Higher Power
    Gossip | R | Restraint of Tongue
    Gratitude | T | Gratitude
    Greed, | C | Character Defects, Money
    Greed, Gluttony, Having Enough | C | Character Defects, Money
    Grief and Mourning | E | Grief
    Group Membership | W | Meetings, Home Group
    Growth | G | Change
    Growth through Pain | G | Pain, Resilience
    Pain is | G | Pain, Resilience
    Guilt | E | Guilt, Amends
    Habits of Sobriety | G | Tools, Routine
    Handling Failure | C | Resilience
    Handling Success | F | Humility
    Happiness | T | Joy
    Happy Joyous and Free | T | Joy, Big Book, Promises
    Happy, Joyous and Free | T | Joy, Big Book, Promises
    Higher Power | S | Higher Power
    Higher Power in Recovery | S | Higher Power, Your Story
    Hitting Bottom | P | Hitting Bottom
    Holidays | C | Holidays, Relapse Prevention
    Honesty | G | Honesty
    Hope | F | Hope
    Spiritual condition | S | Spiritual Practice, Your Story
    How do you work the steps? | G | Steps, Your Story
    How easy does it get? | F | Your Story
    How Have You Changed? | P | Change, Your Story
    How Important Is It? | E | Slogans, Letting Go
    How it Works | G | Steps, Big Book
    How it Works (Twelve Step Recovery) | G | Steps, Big Book
    How were you introduced | P | Your Story, Newcomers
    Humility | G | Humility
    HALT | C | Self-Care, Relapse Prevention, Slogans
    I Am Responsible | W | Service, Responsibility
    Identify, Don't Compare | W | Sharing, Newcomers, Slogans
    Identification | W | Sharing, Newcomers
    If God is in charge... | S | Higher Power, Letting Go
    If it's not practical | S | Spiritual Practice, Slogans
    If nothing changes | G | Change, Slogans
    Nothing Changes | G | Change, Slogans
    Improving the Quality | G | Emotional Sobriety
    Insanity | P | Disease Concept, Steps
    Insidious | C | Disease Concept, Relapse Prevention
    Instincts | G | Character Defects
    Integrity | G | Honesty
    Inventory | G | Inventory, Steps
    Isolating | E | Loneliness
    It Is What It Is | G | Acceptance, Slogans
    Jealousy | E | Character Defects
    Joy | T | Joy
    The Joy of Living | T | Joy
    Joy, The Joy of Living | T | Joy
    Keep Coming Back | W | Meetings, Slogans, Newcomers
    Keep it Simple | G | Slogans
    Keeping it Green | P | Remembering, Relapse Prevention
    Let Go and Let God | S | Letting Go, Surrender, Slogans
    Letting Go | E | Letting Go, Expectations
    Life on Life's Terms | C | Acceptance
    Literature as a Tool | W | Big Book, Tools
    Live and Let Live | R | Slogans, Acceptance
    Living in the Real World | C | Acceptance
    Living in the Moment, | G | Present Moment
    Staying in the Now | G | Present Moment
    Living with Myself | E | Self-Worth
    Lonliness | E | Loneliness
    Loss | E | Grief
    Love | R | Love
    Love & Tolerance | R | Love, Tolerance
    Maintaining Sobriety | C | Relapse Prevention, Tools
    Meditation | S | Meditation
    Meeting Makers Make It | W | Meetings, Slogans
    Meetings | W | Meetings
    Online meetings | W | Meetings
    Zoom (virtual) meetings. | W | Meetings
    Brick & Mortar | W | Meetings
    Too Busy for Meetings? | C | Meetings, Complacency
    Mental Blank | P | Big Book, Relapse Prevention
    Mental | C | Disease Concept
    Spiritual | C | Disease Concept
    Mental, Spiritual and Physical Disease | C | Disease Concept
    Mental Illness | C | Mental Health
    Moderation | P | Disease Concept, Relapse Prevention
    Money | C | Money
    More will be Revealed | F | Hope, Slogans
    Motives | G | Inventory, Honesty
    No Pain/No Gain | G | Pain, Resilience
    One Day at a Time | C | Present Moment, Slogans
    Twenty-four Hours a Day | C | Present Moment, Slogans
    Organized Religion | S | Higher Power, Open-Mindedness
    Other Addictions | C | Other Addictions
    Other Addictions/ fellowships | C | Other Addictions
    Problems Other Than Alcohol | C | Other Addictions, Mental Health
    Pain | E | Pain
    Pass it On | W | Service, Twelfth Step
    Patience | G | Patience
    Pause when Agitated | E | Emotional Sobriety, Big Book
    People Pleasing | R | Boundaries, Self-Worth
    Perceptions vs. Reality | G | Mindset
    Perseverance | F | Resilience
    Perseverance through difficulty | F | Resilience
    Persistence | F | Resilience
    Physical Illness | C | Health
    Powerlessness | P | Steps, Surrender
    Practicing These Principles in All Our Affairs | G | Steps, Twelfth Step
    Practicing These Principles | G | Steps, Twelfth Step
    Prayer | S | Prayer
    The AA Preamble | W | AA Basics
    Pride | G | Ego, Character Defects
    Pride in Reverse | E | Ego, Self-Worth
    Primary Purpose | W | Traditions, Service
    Our Primary Purpose | W | Traditions, Service
    Principles | W | Traditions, Slogans
    Principles Before Personalities | W | Traditions, Slogans
    Priorities | G | Priorities
    Projection | F | Fear, Present Moment
    Progress Not Perfection | G | Slogans
    Progress, Not Perfection | G | Slogans
    Progression | P | Disease Concept
    Promises | F | Promises, Big Book
    Rationalization | P | Honesty, Denial
    Recovered or Recovering? | F | Big Book
    Recovery | F | Hope
    Regret | P | Promises, Guilt
    Relapse | C | Relapse Prevention
    Slips | C | Relapse Prevention
    Relationships | R | Relationships
    Relaxing, Relaxation | G | Self-Care
    Remember | P | Remembering, Gratitude
    Remembering | P | Remembering, Relapse Prevention
    Remembering Your Last Drunk | P | Remembering, Relapse Prevention
    Your last drunk. | P | Remembering, Your Story
    Remorse | E | Guilt, Amends
    Resentment, | E | Resentment, Inventory
    Resentment | E | Resentment, Inventory
    Resolutions | F | Goals
    Responsibility | G | Responsibility
    Self-Compassion | E | Self-Worth, Forgiveness
    RID | E | Emotional Sobriety
    Restless, Irritable and Discontented (RID) | E | Emotional Sobriety
    Restraint of Tongue and Pen | R | Restraint of Tongue
    Rituals of Sobriety | G | Routine, Tools
    Road Rage | E | Anger
    Rule #62 | T | Humor, Traditions
    Rule 62 | T | Humor, Traditions
    We are not a glum lot | T | Humor, Joy, Big Book
    Sanity | S | Steps, Higher Power
    Secrets | P | Honesty, Steps
    Telling on Yourself | W | Honesty, Sharing
    Self Acceptance | E | Self-Worth, Acceptance
    Self-Acceptance | E | Self-Worth, Acceptance
    Self-Centeredness | G | Ego, Character Defects
    Self Esteem | E | Self-Worth
    Self Pity | E | Self-Pity
    Self-Pity | E | Self-Pity
    Self Seeking | G | Ego, Promises
    Self-Will | S | Surrender, Ego
    Will power | S | Surrender, Ego
    Selfishness | G | Ego, Character Defects
    Serenity | S | Serenity
    Serenity Prayer | S | Serenity Prayer, Prayer
    Serenity Prayer long form | S | Serenity Prayer, Prayer
    Wisdom | S | Serenity Prayer
    Wisdom to Know | S | Serenity Prayer
    Service | W | Service
    Self-Supporting | W | Traditions, Service
    Sex | R | Relationships, Inventory
    Sharing at Meetings | W | Sharing, Meetings
    Sick and Tired | P | Hitting Bottom, Slogans
    Sick and Tired of Being Sick and Tired | P | Hitting Bottom, Slogans
    Slogans | G | Slogans
    Slogans/AA Sayings | G | Slogans
    Spiritual Awakening | S | Spiritual Awakening, Steps
    Turning Point | P | Surrender, Big Book
    Spiritual Axiom | S | Resentment, Inventory
    Spiritual Malady | S | Disease Concept, Emotional Sobriety
    The Spiritual Part | S | Spiritual Practice
    Spiritual Part of the Program | S | Spiritual Practice
    Spirituality | S | Spiritual Practice
    Sponsorship | W | Sponsorship
    Starting the Day Over | C | Present Moment, Tools
    Step One | S | Steps, Surrender
    Step 1: | S | Steps, Surrender
    Step Two | S | Steps, Higher Power
    Step 2: | S | Steps, Higher Power
    Step Three | S | Steps, Surrender
    Step 3: | S | Steps, Surrender
    Step Four | P | Steps, Inventory
    Step 4: | P | Steps, Inventory
    Step Five | P | Steps, Honesty
    Step 5: | P | Steps, Honesty
    Step Six | G | Steps, Character Defects, Willingness
    Step 6: | G | Steps, Character Defects, Willingness
    Step Seven | G | Steps, Character Defects, Humility
    Step 7: | G | Steps, Character Defects, Humility
    Step Eight | R | Steps, Amends
    Step 8: | R | Steps, Amends
    Step Nine | R | Steps, Amends
    Step 9: | R | Steps, Amends
    Step Ten | G | Steps, Inventory
    Step 10: | G | Steps, Inventory
    Step Eleven | S | Steps, Prayer, Meditation
    Step 11: | S | Steps, Prayer, Meditation
    Step Twelve | W | Steps, Service, Twelfth Step
    Step 12: | W | Steps, Service, Twelfth Step
    Stick with the Winners | W | Slogans, Newcomers
    Stinking Thinking | C | Mindset, Relapse Prevention
    Strength | W | Sharing
    Stress | C | Self-Care
    Suggestions | G | Willingness, Newcomers
    Surrender | S | Surrender
    Taking Risks | F | Courage, Change
    Taking Things for Granted | T | Gratitude, Complacency
    Think it Through | C | Relapse Prevention, Slogans
    Think Think Think | G | Slogans, Mindset
    Think, Think, Think | G | Slogans, Mindset
    This Too Shall Pass | E | Slogans, Hope
    Time | F | Patience, Slogans
    Time (Time Takes Time) | F | Patience, Slogans
    To Thine Own Self Be True | G | Honesty
    Tolerance | R | Tolerance
    Tools of the Program | G | Tools
    Tradition One | W | Traditions, Unity
    Tradition Two | W | Traditions, Higher Power
    Tradition Three | W | Traditions, Newcomers
    Only requirement | W | Traditions, Newcomers
    Tradition Four | W | Traditions
    Tradition Five | W | Traditions, Service
    Tradition Six | W | Traditions
    Tradition Seven | W | Traditions, Money
    Tradition Eight | W | Traditions, Service
    Tradition Nine | W | Traditions, Service
    Tradition Ten | W | Traditions
    Tradition Eleven | W | Traditions, Anonymity
    Tradition Twelve | W | Traditions, Anonymity
    Triggers | C | Triggers, Relapse Prevention
    When others are drinking | C | Triggers, Relapse Prevention
    Trust | R | Trust
    Trust God | S | Higher Power, Faith, Trust
    Trust the process | F | Faith, Patience
    Clean House | G | Big Book, Inventory, Amends
    Help Others | W | Service, Big Book
    Turning it Over | S | Surrender, Letting Go
    Twelfth Step Calls | W | Service, Twelfth Step
    Unmanageability | P | Steps, Hitting Bottom
    Using the Program | C | Tools, Relapse Prevention
    Using the Telephone | W | Tools, Newcomers
    Utilize Don't Analyze | G | Slogans, Action
    Wait to Worry | E | Fear, Slogans
    We of the Program | W | Unity
    We Program | W | Unity
    Unity | W | Unity, Traditions
    Unity, Service, and Recovery | W | Unity, Service
    What Convinced You That You Had a Problem? | P | Your Story, Hitting Bottom
    What Convinced You | P | Your Story, Hitting Bottom
    What is AA? | W | AA Basics, Newcomers
    What do You do | C | Your Story, Tools
    What do You do to Stay Sober? | C | Your Story, Tools
    What do you love about AA? | T | Your Story, Gratitude
    What have you gained | T | Your Story, Gratitude, Promises
    Outside Forces | C | Your Story, Relapse Prevention
    What Step are you on? | G | Steps, Your Story
    Who supported you? | T | Your Story, Gratitude
    Why Are You Here? | P | Your Story, Newcomers
    Why did you get sober? | P | Your Story
    Willing to go | S | Willingness, Big Book
    Willing to go to Any Lengths | S | Willingness, Big Book
    Willingness | G | Willingness
    Wreckage of the Past | P | Amends, Big Book
    Yets | P | Hitting Bottom, Relapse Prevention
    Yet's | P | Hitting Bottom, Relapse Prevention
    Live It | W | Service, Big Book
    Contrary Action | G | Action
    Disease of More | C | Disease Concept, Character Defects
    If you spot it, you got it | G | Inventory, Slogans
  LIST

  # Heavy topics (risky choices and ghosts lean towards these)
  CURATION_DEEP = <<~LIST
    Hitting Bottom
    Stop Digging
    Gift of Desperation
    Grief and Mourning
    Loss
    Guilt
    Remorse
    Regret
    Relapse
    Slips
    Resentment,
    Resentment
    Spiritual Axiom
    Fear
    Fear of Failure
    Anger
    Road Rage
    Amends
    Amends Beyond I'm Sorry
    Unfinished Amends
    Step One
    Step 1:
    Step Four
    Step 4:
    Step Five
    Step 5:
    Step Eight
    Step 8:
    Step Nine
    Step 9:
    Exact Nature of our Wrongs
    Secrets
    Telling on Yourself
    Character Defects
    Self Pity
    Self-Pity
    Pride in Reverse
    Self Esteem
    Wreckage of the Past
    Your last drunk.
    Remembering
    Remembering Your Last Drunk
    What Convinced You That You Had a Problem?
    What Convinced You
    Why did you get sober?
    Sick and Tired
    Sick and Tired of Being Sick and Tired
    Yets
    Yet's
    Turning Point
    Mental Illness
    Physical Illness
    Sex
    Codependence
    Isolating
    Lonliness
    Being Alone
    Feeling Different
    Terminal Uniqueness
    Pain
    Forgiving Ourselves
    Forgiving Others
    Denial
    Rationalization
    Powerlessness
    Unmanageability
    Insanity
    Spiritual Malady
    Jealousy
    Economic Insecurity
    Disappointment
    Dry Drunks
    Emotional Hangover
    Handling Failure
    Self-Will
    Will power
    Ego
    Self-Centeredness
    Selfishness
    Pride
  LIST

  # Light, welcoming topics (campfires lean towards these)
  CURATION_GENTLE = <<~LIST
    Gratitude
    Joy
    The Joy of Living
    Joy, The Joy of Living
    Fun
    Happiness
    Enjoying Life
    Happy Joyous and Free
    Happy, Joyous and Free
    Celebrations in Sobriety
    Anniversaries
    Sobriety Dates
    Rule #62
    Rule 62
    We are not a glum lot
    Keep it Simple
    Easy Does It
    One Day at a Time
    Twenty-four Hours a Day
    First Things First
    Keep Coming Back
    Meeting Makers Make It
    Meetings
    Online meetings
    Zoom (virtual) meetings.
    Brick & Mortar
    Fellowship
    Friendship
    Group Membership
    What do you love about AA?
    Who supported you?
    What have you gained
    What is AA?
    The AA Preamble
    How were you introduced
    Hope
    Expect a Miracle
    More will be Revealed
    Gifts of the Program
    Promises
    Freedom
    Fourth Dimension
    Serenity
    Serenity Prayer
    Serenity Prayer long form
    Relaxing, Relaxation
    Balance
    Patience
    Using the Telephone
    Literature as a Tool
    Big Book
    Tools of the Program
    Habits of Sobriety
    Rituals of Sobriety
    Service
    Being Useful
    Stick with the Winners
    Love
    Compassion
    Live and Let Live
    This Too Shall Pass
    Act As If
    Fake It Till You Make It
    Bring the Body
    Bring the Body and the Mind Will Follow
    Don't Drink
    Don't Quit
    Identify, Don't Compare
    Identification
    Taking Things for Granted
    Unity
    We Program
    We of the Program
    Trust the process
    Recovery
    Resolutions
    But For the Grace of God
  LIST

  curation_key = ->(text) do
    text.to_s.unicode_normalize(:nfkd).downcase.gsub(/[’‘]/, "'").sub(/\A\(a\)\s*/, "").gsub(/[^a-z0-9 ]/, " ").squeeze(" ").strip
  end

  curation_rules = -> do
    CURATION.lines.map(&:strip).reject(&:empty?).to_h do |line|
      title, code, tags = line.split("|").map(&:strip)
      raise "Unknown category code #{code} on: #{line}" unless CURATION_CATEGORIES.key?(code)
      [curation_key.(title), { category: CURATION_CATEGORIES.fetch(code), tags: tags.to_s.split(",").map(&:strip).reject(&:empty?) }]
    end
  end

  desc "Fill in categories and add tags on Topicificator topics (APPLY=1 to write)"
  task curate: :environment do
    apply = ENV["APPLY"] == "1"
    rules = curation_rules.()

    categories = TopicCategory.all.index_by { |c| curation_key.(c.title) }
    difficulty_for = {}
    { "deep" => CURATION_DEEP, "gentle" => CURATION_GENTLE }.each do |level, list|
      list.lines.map(&:strip).reject(&:empty?).each { |t| difficulty_for[curation_key.(t)] = level }
    end

    missing = CURATION_CATEGORIES.values.reject { |title| categories.key?(curation_key.(title)) }
    abort "These categories don't exist yet, so nothing was changed: #{missing.join(', ')}" if missing.any?

    unmatched = []
    changes = []
    set_names = TopicSet.pluck(:id, :name).to_h
    Topic.includes(:tags).find_each do |topic|
      rule = rules[curation_key.(topic.title)]
      unless rule
        unmatched << topic
        next
      end
      category = categories.fetch(curation_key.(rule[:category]))
      have = topic.tags.map { |t| curation_key.(t.title) }
      new_tags = rule[:tags].reject { |t| have.include?(curation_key.(t)) }
      set_category = topic.topic_category_id.nil?
      difficulty = (difficulty_for[curation_key.(topic.title)] || "standard") if topic.difficulty.nil?
      next if !set_category && new_tags.empty? && difficulty.nil?
      changes << { id: topic.id, title: topic.title, category_id: (category.id if set_category), category: rule[:category], new_tags: new_tags, difficulty: difficulty, kept_category: !set_category }
    end

    by_category = changes.select { |c| c[:category_id] }.group_by { |c| c[:category] }
    CURATION_CATEGORIES.each_value do |title|
      list = by_category[title] || []
      puts "#{title}: #{list.size}#{" (#{list.first(4).map { |c| c[:title].strip }.join(', ')}#{list.size > 4 ? ', ...' : ''})" if list.any?}"
    end
    tag_counts = changes.flat_map { |c| c[:new_tags] }.tally.sort_by { |t, n| [-n, t] }
    puts "\nTags to add: #{tag_counts.map { |t, n| "#{t} (#{n})" }.join(', ')}"
    puts "\nDifficulty: #{changes.filter_map { |c| c[:difficulty] }.tally.sort.map { |d, n| "#{d} #{n}" }.join(', ')}"
    puts "\n#{changes.count { |c| c[:category_id] }} topics get a category; #{changes.count { |c| c[:new_tags].any? }} get new tags; #{changes.count { |c| c[:kept_category] }} keep the category they already had."
    if unmatched.any?
      puts "\n#{unmatched.size} topics didn't match and are left alone:"
      unmatched.each { |t| puts "  ##{t.id} [#{set_names[t.topic_set_id]}] #{t.title}" }
    end

    unless apply
      puts "\nPreview only. Run again with APPLY=1 to write these changes."
      next
    end

    tag_cache = {}
    find_tag = ->(title) { tag_cache[title] ||= Tag.where("LOWER(title) = ?", title.downcase).first || Tag.create!(title: title) }
    Topic.transaction do
      changes.each do |c|
        Topic.where(id: c[:id], topic_category_id: nil).update_all(topic_category_id: c[:category_id]) if c[:category_id]
        Topic.where(id: c[:id], difficulty: nil).update_all(difficulty: c[:difficulty]) if c[:difficulty]
        c[:tag_ids] = c[:new_tags].map { |title| TopicTag.find_or_create_by!(topic_id: c[:id], tag_id: find_tag.(title).id).tag_id }
      end
    end
    file = Rails.root.join("tmp", "topic_curation_#{Time.current.strftime('%Y%m%d%H%M%S')}.json")
    File.write(file, JSON.pretty_generate(changes))
    puts "\nApplied. Undo record: #{file.relative_path_from(Rails.root)}"
  end

  desc "Undo a topics:curate run (FILE=tmp/topic_curation_....json)"
  task undo_curate: :environment do
    changes = JSON.parse(File.read(ENV.fetch("FILE")))
    Topic.transaction do
      changes.each do |c|
        Topic.where(id: c["id"], topic_category_id: c["category_id"]).update_all(topic_category_id: nil) if c["category_id"]
        Topic.where(id: c["id"], difficulty: c["difficulty"]).update_all(difficulty: nil) if c["difficulty"]
        TopicTag.where(topic_id: c["id"], tag_id: c["tag_ids"]).delete_all if c["tag_ids"].present?
      end
    end
    puts "Undid #{changes.size} topics. Tags it created are kept (they may be on readings now)."
  end
end
