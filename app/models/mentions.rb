# @ mentions in chat messages, notes and comments. An @ after a space or the start of a line
# (so not in an email address), then a username (User::USERNAME: letters, numbers and dashes)
# or one of a group's role handles:
#
#   @admins @hosts @recordkeepers @coordinators @treasurers   the people holding that role
#   @secretary @gsr @chair...                                  whoever holds that service position now
#   @everyone                                                  everyone who can read it (admins only)
#
# Role handles only mean something where there's a group: a chat channel's, or the groups a
# note is shared to. There a role wins over a username that happens to be the same.
# Code (`@this`) doesn't count. book/Markdown.jsx shows them the same way, from `mentions`.
module Mentions
  PATTERN = /(?<![\p{L}\p{N}_@.\/&-])@([a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?)(?![\p{L}\p{N}_])/i

  ROLES = {
    "admins" => { label: "Admins", users: ->(g) { g.admins } },
    "hosts" => { label: "Hosts", users: ->(g) { g.host_pool } },
    "recordkeepers" => { label: "Record keepers", users: ->(g) { g.record_keepers } },
    "coordinators" => { label: "Host coordinators", users: ->(g) { g.host_schedulers } },
    "treasurers" => { label: "Treasurers", users: ->(g) { g.treasurers } },
    "everyone" => { label: "Everyone", users: ->(g) { g.members } },
  }.freeze

  # The handles in `markdown`, in lowercase, each once, in the order they first come
  def self.handles(markdown)
    text = markdown.to_s.gsub(/^```.*?^```/m, " ").gsub(/`[^`\n]+`/, " ")
    text.scan(PATTERN).map { |(h)| h.downcase }.uniq
  end

  # A service position's handle: its title in lowercase with dashes ("General Service Rep" ->
  # @general-service-rep), or nil when it's taken by a role
  def self.position_handle(title)
    handle = title.to_s.parameterize.first(50).sub(/-+\z/, "")
    handle if handle.length >= 2 && !ROLES.key?(handle)
  end

  # The role handles in `group`: { handle => { label:, users: (a relation or array), position: true? } }
  def self.roles(group, today = Date.current)
    roles = ROLES.transform_values { |r| { label: r[:label], users: -> { r[:users].call(group) } } }
    group.service_positions.where(archived: false).includes(terms: :user).each do |position|
      handle = position_handle(position.title) or next
      user = position.current_term(today)&.user
      roles[handle] ||= { label: position.title, users: -> { user ? [user] : [] }, position: true }
    end
    roles
  end

  # What @ mentions in `text` mean: { map: { handle => { "type" => "person"|"role", ... } },
  # reasons: { user_id => nil (named themselves) or the role handle } }. `groups` are where role
  # handles come from; `everyone` replaces who @everyone means (a channel's members), and
  # false leaves it out.
  def self.resolve(text, groups: [], everyone: nil)
    handles = self.handles(text)
    return { map: {}, reasons: {} } if handles.empty?

    map = {}
    reasons = {}
    roles = groups.map { |g| roles(g) }
    handles.each do |handle|
      found = roles.filter_map { |r| r[handle] }
      next if found.empty? || (handle == "everyone" && everyone == false)

      map[handle] = { "type" => "role", "label" => found.first[:label] }
      users = handle == "everyone" && everyone ? everyone : found.flat_map { |r| r[:users].call.to_a }
      users.each { |u| reasons[u.id] = handle unless reasons.key?(u.id) }
    end
    people = User.where("LOWER(username) IN (?)", handles - map.keys)
    people.each do |user|
      map[user.username.downcase] = { "type" => "person", "id" => user.id, "username" => user.username, "name" => user.display_name }
      reasons[user.id] = nil
    end
    { map: map, reasons: reasons }
  end
end
