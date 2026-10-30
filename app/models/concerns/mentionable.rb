# Something written that can @ mention people (Mentions): chat messages, notes and their
# comments. `mentions` keeps what each handle meant when it was written, for showing it, and
# `mentioned_user_ids` who has been told, so editing it only tells people newly mentioned.
module Mentionable
  extend ActiveSupport::Concern

  # Reads the mentions in `text` into `mentions`, and gives who should now be told, as
  # { user => nil (named) or the role handle }: not the author, nobody told before, and only
  # people `can_see` lets read it. Call before saving, then #tell_mentioned after.
  def take_mentions(text, author:, groups: [], everyone: nil, can_see: ->(_) { true })
    found = Mentions.resolve(text, groups: groups, everyone: everyone)
    self.mentions = found[:map]
    ids = found[:reasons].keys - [author.id] - Array(mentioned_user_ids)
    users = User.where(id: ids).to_a.select { |u| can_see.call(u) }
    users.to_h { |u| [u, found[:reasons][u.id]] }
  end

  # Sends each of them a bell notification (and push) and remembers they were told.
  # `title` is given the handle (nil for "you").
  def tell_mentioned(people, kind:, title:, body:, url:)
    return if people.empty?

    people.each { |user, handle| Notification.deliver(user, kind: kind, title: title.call(handle), body: body, url: url) }
    update_column(:mentioned_user_ids, (Array(mentioned_user_ids) | people.keys.map(&:id)))
  end

  # Whether `user` was mentioned (by name or a role they hold), for highlighting it
  def mentions?(user) = !!user && Array(mentioned_user_ids).include?(user.id)
end
