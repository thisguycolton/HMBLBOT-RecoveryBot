# Every kind of motion in Robert's Rules, with what the rules say about it: whether it needs a
# second, whether it can be debated or amended, what vote carries it, where it ranks (a motion
# is out of order while a higher-ranking one is pending) and what it does to the motion it
# applies to. The app only records votes taken in the room, so this is used to warn a secretary
# when a record doesn't add up (see Motion#warnings), never to stop one.
module MotionKinds
  GROUPS = {
    "main" => "Main motion",
    "subsidiary" => "Subsidiary (about a pending motion)",
    "privileged" => "Privileged (urgent, about the meeting)",
    "incidental" => "Incidental (about how business is done)",
    "bring_back" => "Bringing a question back",
  }.freeze

  # vote: majority, two_thirds, rescind (a majority with previous notice, otherwise two thirds),
  # tie_sustains (an appeal: a tie sustains the chair), none (the chair rules, or nobody votes)
  # effect: what it does to the motion it applies to, once it passes
  def self.kind(key, label, group, rank: nil, second: true, debatable: true, amendable: false, vote: "majority", pending: false, effect: nil, help: nil)
    { key: key, label: label, group: group, rank: rank, second: second, debatable: debatable, amendable: amendable,
      vote: vote, pending: pending, effect: effect, help: help }.freeze
  end

  ALL = [
    kind("main", "Main motion", "main", rank: 10, amendable: true, help: "Brings business before the group: \"I move that...\""),
    kind("amend", "Amend", "subsidiary", rank: 35, amendable: true, pending: true, help: "Changes the wording of the motion on the floor"),
    kind("postpone_indefinitely", "Postpone indefinitely", "subsidiary", rank: 30, pending: true, effect: "postponed_indefinitely", help: "Kills the motion for this meeting; it may come back later"),
    kind("commit", "Commit or refer to a committee", "subsidiary", rank: 40, amendable: true, pending: true, effect: "referred", help: "Sends the motion to a committee to report back"),
    kind("postpone_definitely", "Postpone to a certain time", "subsidiary", rank: 45, debatable: "limited", amendable: true, pending: true, effect: "postponed", help: "Puts the motion off to a stated time"),
    kind("limit_debate", "Limit or extend debate", "subsidiary", rank: 50, debatable: false, amendable: true, vote: "two_thirds", pending: true),
    kind("previous_question", "Previous question (close debate)", "subsidiary", rank: 55, debatable: false, vote: "two_thirds", pending: true, help: "\"I call the question\": ends debate and votes now"),
    kind("lay_on_table", "Lay on the table", "subsidiary", rank: 60, debatable: false, pending: true, effect: "tabled", help: "Sets the business aside to take up later"),
    kind("fix_time_to_adjourn", "Fix the time to adjourn", "privileged", rank: 90, amendable: true),
    kind("adjourn", "Adjourn", "privileged", rank: 85, debatable: false, help: "Ends the meeting"),
    kind("recess", "Recess", "privileged", rank: 80, debatable: false, amendable: true),
    kind("question_of_privilege", "Question of privilege", "privileged", rank: 75, second: false, debatable: false, vote: "none", help: "About comfort or the rights of the group; the chair rules"),
    kind("orders_of_the_day", "Call for the orders of the day", "privileged", rank: 70, second: false, debatable: false, vote: "none"),
    kind("point_of_order", "Point of order", "incidental", second: false, debatable: false, vote: "none", help: "The chair rules"),
    kind("appeal", "Appeal the chair's decision", "incidental", vote: "tie_sustains", help: "A tie sustains the chair"),
    kind("suspend_rules", "Suspend the rules", "incidental", debatable: false, vote: "two_thirds"),
    kind("objection_to_consideration", "Objection to consideration", "incidental", second: false, debatable: false, vote: "two_thirds", help: "Two thirds must vote against considering it"),
    kind("division_of_question", "Divide the question", "incidental", amendable: true, debatable: false, pending: true),
    kind("division_of_assembly", "Division of the assembly (standing vote)", "incidental", second: false, debatable: false, vote: "none", help: "One member can demand it when a voice vote is doubted"),
    kind("parliamentary_inquiry", "Parliamentary inquiry", "incidental", second: false, debatable: false, vote: "none"),
    kind("withdraw_motion", "Withdraw a motion", "incidental", second: false, debatable: false, pending: true),
    kind("take_from_table", "Take from the table", "bring_back", debatable: false, effect: "proposed", pending: true, help: "Brings a tabled motion back before the group"),
    kind("rescind", "Rescind or amend something already adopted", "bring_back", vote: "rescind", help: "Two thirds, or a majority if notice was given"),
    kind("reconsider", "Reconsider", "bring_back", effect: "proposed", pending: true, help: "Has the vote on a motion taken again"),
    kind("discharge_committee", "Discharge a committee", "bring_back", vote: "rescind"),
  ].freeze

  BY_KEY = ALL.index_by { |k| k[:key] }.freeze
  KEYS = BY_KEY.keys.freeze
  # What belongs in the decisions log; the rest is procedure around them
  DECISION_KINDS = %w[main rescind].freeze

  REQUIRED_VOTES = {
    "majority" => "A majority of the votes cast",
    "two_thirds" => "Two thirds of the votes cast",
    "three_fourths" => "Three fourths of the votes cast",
    "unanimous" => "Unanimous (nobody against)",
    "entire_membership" => "A majority of the entire membership",
  }.freeze
  VOTE_METHODS = {
    "voice" => "Voice (ayes and noes)",
    "rising" => "Standing (rising) vote",
    "show_of_hands" => "Show of hands",
    "ballot" => "Ballot",
    "roll_call" => "Roll call",
    "general_consent" => "General consent (no objection)",
  }.freeze

  module_function

  def find(key) = BY_KEY[key.to_s] || BY_KEY["main"]

  # The vote that carries it: what its owner set (the bylaws), or what the rules ask for this kind
  # of motion; nil when nobody votes on it
  def required_vote(kind_key, override: nil, previous_notice: false)
    return override if override.present?

    case find(kind_key)[:vote]
    when "rescind" then previous_notice ? "majority" : "two_thirds"
    when "none" then nil
    when "tie_sustains" then "majority"
    else find(kind_key)[:vote]
    end
  end

  def metadata
    { kinds: ALL, groups: GROUPS, required_votes: REQUIRED_VOTES, vote_methods: VOTE_METHODS }
  end
end
