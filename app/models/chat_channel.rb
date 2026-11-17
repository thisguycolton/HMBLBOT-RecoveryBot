# A channel in a group's chat (Api::GroupChatController, GroupChatChannel): #general, which
# every group has, and the ones people add. Who's in it: the group's admins always, then
# everyone ("members" in access_roles), or the members holding one of its roles, and the
# people named in access_user_ids. Members read and write in the channels they're in;
# messages arrive live (GroupChatChannel), and only @ mentions notify anyone (Mentions).
class ChatChannel < ApplicationRecord
  moderates_language :name, :topic
  # Who a channel can be open to, and who an admin can let add channels (Group#chat_creator_roles)
  ROLES = {
    "members" => "Everyone in the group",
    "hosts" => "Hosts",
    "record_keepers" => "Record keepers",
    "host_coordinators" => "Host coordinators",
    "treasurers" => "Treasurers",
  }.freeze
  NAME = /\A[a-z0-9][a-z0-9-]{0,39}\z/

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true
  has_many :messages, class_name: "ChatMessage", dependent: :delete_all
  has_many :reads, class_name: "ChatRead", dependent: :delete_all

  before_validation do
    self.name = name.to_s.strip.downcase.delete_prefix("#").gsub(/[\s_]+/, "-").gsub(/[^a-z0-9-]/, "").squeeze("-").sub(/\A-+/, "").first(40).sub(/-+\z/, "")
    self.topic = topic.to_s.squish
    self.access_roles = ROLES.keys & Array(access_roles).map(&:to_s)
    self.access_user_ids = Array(access_user_ids).map(&:to_i).uniq.reject(&:zero?)
  end
  before_validation(on: :create) { self.position = (group.chat_channels.maximum(:position) || 0) + 1 if position.zero? }

  validates :name, presence: true, format: { with: NAME, message: "can use lowercase letters, numbers and dashes" }
  validates :name, uniqueness: { scope: :group_id, case_sensitive: false, message: "is already a channel here" }
  validates :topic, length: { maximum: 250 }
  validate { errors.add(:access_roles, "needs someone in it") if access_roles.empty? && access_user_ids.empty? && !general? }

  scope :ordered, -> { order(:archived, :position, :id) }
  scope :open, -> { where(archived: false) }

  def general? = name == "general"
  def everyone? = access_roles.include?("members")
  def stream = "chat:#{id}"

  # Whether `user` is in it: an active member of the group it's open to (its admins always)
  def readable_by?(user, membership = group.membership_for(user))
    return false unless user && membership&.active?
    return true if everyone? || membership.admin? || access_user_ids.include?(user.id)

    access_roles.any? { |role| group.holds_chat_role?(user, role, membership) }
  end

  # Everyone in it, for @everyone
  def readers
    return group.members.to_a if everyone?

    group.active_memberships.includes(:user).select { |m| readable_by?(m.user, m) }.map(&:user)
  end

  # Admins and whoever added it change its name, topic and who's in it, or archive it; #general
  # stays open to everyone
  def manageable_by?(user) = group.manageable_by?(user) || (created_by_id.present? && created_by_id == user&.id)

  # How many messages from others each of these channels has that `user` hasn't read: { id => n }
  def self.unread_counts(channels, user)
    ids = channels.map(&:id)
    return {} if ids.empty?

    ChatMessage.where(chat_channel_id: ids).where.not(user_id: [user.id, *user.blocked_ids])
               .joins("LEFT JOIN chat_reads r ON r.chat_channel_id = chat_messages.chat_channel_id AND r.user_id = #{user.id.to_i}")
               .where("chat_messages.id > COALESCE(r.last_read_message_id, 0)")
               .group(:chat_channel_id).count
  end

  def as_api_json(viewer:, unread: 0)
    {
      id: id, name: name, topic: topic, archived: archived, general: general?,
      access_roles: access_roles, access_user_ids: access_user_ids,
      last_message_at: last_message_at&.iso8601, unread: unread,
      can_manage: manageable_by?(viewer),
    }
  end
end
