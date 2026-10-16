# Puts someone in the group an invite link points at (GroupsController#join, and after
# sign-in for links followed while signed out). Returns the group, or nil.
module JoinsGroupFromInvite
  module_function

  def call(user, token)
    group = token.present? && Group.find_by(join_token: token)
    return unless group && user

    membership = group.memberships.find_or_initialize_by(user: user)
    membership.status = "active"
    membership.role ||= "member"
    membership.save!
    UserActiveGroup.find_or_create_by!(user: user) { |a| a.group = group } unless user.user_active_group
    group
  end
end
