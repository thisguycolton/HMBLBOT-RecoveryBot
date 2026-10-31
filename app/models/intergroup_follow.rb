# Following a group AA Intergroup lists that isn't on RecoveryBot yet (its page at
# /groups/find/:oiaa_slug). Matched by the group's name, lower-cased, as the listings give it;
# when a group by that name (or with one of those meetings) is approved here, its followers are
# told, once.
class IntergroupFollow < ApplicationRecord
  moderates_language :group_name
  belongs_to :user

  before_validation { self.group_name = group_name.to_s.squish.downcase }
  validates :group_name, presence: true, uniqueness: { scope: :user_id }
  validates :oiaa_slug, presence: true

  scope :waiting, -> { where(notified_at: nil) }

  def self.key_for(record) = (record.group_name.presence || record.name).to_s.squish.downcase

  # A group just went live: tell whoever was following it
  def self.announce!(group)
    slugs = group.meetings.where.not(oiaa_slug: nil).pluck(:oiaa_slug)
    names = OiaaMeeting.where(slug: slugs).map { |r| key_for(r) } + [group.title.to_s.squish.downcase]
    follows = waiting.where(group_name: names.uniq).or(waiting.where(oiaa_slug: slugs)).includes(:user)
    return if follows.empty?

    Notification.deliver(follows.map(&:user), kind: "group.followed_arrived", title: "#{group.title} is on RecoveryBot now",
                                              body: "You followed it. Open its page to ask to join.", url: "/groups/#{group.slug}")
    follows.update_all(notified_at: Time.current)
  end
end
