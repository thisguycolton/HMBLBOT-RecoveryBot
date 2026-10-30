# What typing @ offers (Mentions): people, and a group's role handles. In a chat channel
# (group, channel): the people in it and the group's roles (@everyone for its admins). In a
# note (groups[]: the groups it's shared to): people you follow, who follow you or share a
# group with you, and the roles of those groups.
class Api::MentionsController < ApplicationController
  include GroupScoped

  LIMIT = 8

  # GET /api/mentions?q=&group=slug&channel=id | groups[]=slug -> { people: [], roles: [{ handle, label }] }
  def index
    q = params[:q].to_s.strip.downcase.delete_prefix("@")
    people, groups = params[:channel].present? ? channel_scope : note_scope
    people = people.where("LOWER(users.username) LIKE :q OR LOWER(users.name) LIKE :q OR LOWER(users.name) LIKE :w",
                          q: "#{User.sanitize_sql_like(q)}%", w: "% #{User.sanitize_sql_like(q)}%") if q.present?
    people = people.where.not(id: current_user.id).includes(avatar_attachment: :blob).order(:name).limit(LIMIT)
    render json: { people: people.map(&:as_person_json), roles: roles(groups, q) }
  end

  private

  def channel_scope
    group = Group.find_by!(slug: params[:group].to_s)
    channel = group.chat_channels.find(params[:channel])
    raise ActiveRecord::RecordNotFound unless channel.readable_by?(current_user)

    [User.where(id: channel.readers.map(&:id)), [group]]
  end

  def note_scope
    mine = current_user.groups
    ids = Follow.where(follower_id: current_user.id).select(:followed_id)
    by = Follow.where(followed_id: current_user.id).select(:follower_id)
    together = GroupMembership.active.where(group_id: mine.select(:id)).select(:user_id)
    people = User.where(id: ids).or(User.where(id: by)).or(User.where(id: together))
    [people, mine.where(slug: Array(params[:groups]).map(&:to_s)).to_a]
  end

  def roles(groups, q)
    groups.flat_map do |group|
      Mentions.roles(group).filter_map do |handle, role|
        next if handle == "everyone" && (params[:channel].blank? || !group.manageable_by?(current_user))
        next unless handle.start_with?(q) || role[:label].downcase.split.any? { |word| word.start_with?(q) }

        { handle: handle, label: role[:label], group: (group.title if groups.size > 1) }
      end
    end.uniq { |r| r[:handle] }.first(LIMIT)
  end
end
