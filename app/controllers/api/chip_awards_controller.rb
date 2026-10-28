# Giving chips (/recovery/give): a group's hosts, host coordinators, record keepers and admins
# (Group#can_host?) give a round chip in the group's design to a member or to an email address
# (ChipAward). An address with an account gets it straight away; any other gets an email with
# a link to claim it (ChipMailer, ChipsController#claim).
class Api::ChipAwardsController < ApplicationController
  include GroupScoped
  # Emails to addresses without an account, per giver per day, so this can't be used to spam
  EMAILS_PER_DAY = 25

  # GET /api/chip_awards -> the groups they can give for, with their members, and chips given
  # there (by them, or by anyone for a group they run)
  def index
    groups = giving_groups
    render json: {
      groups: groups.map do |g|
        { slug: g.slug, title: g.title, logo_url: g.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(g.logo, only_path: true) : nil,
          design: ChipDesign.for_group(g),
          members: g.active_memberships.includes(:user).map(&:user).sort_by { |u| u.display_name.downcase }.map { |u| { id: u.id, name: u.display_name } } }
      end,
      given: given_scope(groups).includes(:group, :user, :given_by).order(created_at: :desc).limit(100).map(&:as_api_json),
    }
  end

  # POST /api/chip_awards { group_slug, user_id | email, milestone_key, years, on, note }
  def create
    group = giving_groups.find { |g| g.slug == params[:group_slug].to_s }
    return render(json: { error: "You can only give chips for a group you host for." }, status: :forbidden) unless group

    member = group.members.find_by(id: params[:user_id]) if params[:user_id].present?
    return render(json: { error: "Pick someone in the group, or enter an email address." }, status: :unprocessable_entity) if params[:user_id].present? && !member

    award = group.chip_awards.new(given_by: current_user, email: member&.email || params[:email].to_s, milestone_key: params[:milestone_key].to_s,
                                  years: params[:years].presence&.to_i, on: StepInventory.parse_day(params[:on]) || Date.current, note: params[:note].to_s.strip)
    return render(json: { error: award.errors.full_messages.to_sentence }, status: :unprocessable_entity) unless award.valid?

    account = member || User.where.not(confirmed_at: nil).find_by("lower(email) = ?", award.email)
    if account
      award.save!
      award.claim!(account)
    else
      sent_today = current_user.chip_awards_given.where(created_at: 1.day.ago.., user_id: nil).count
      return render(json: { error: "That's as many chips as you can email in a day. Try again tomorrow." }, status: :too_many_requests) if sent_today >= EMAILS_PER_DAY

      award.save!
      ChipMailer.with(award: award).given.deliver_later
    end
    render json: { award: award.as_api_json, emailed: account.nil? }, status: :created
  end

  # DELETE /api/chip_awards/:id -> taken back, by whoever gave it or the group's admins
  def destroy
    award = given_scope(giving_groups).find(params[:id])
    award.destroy!
    head :no_content
  end

  private

  def giving_groups = current_user.groups.includes(logo_attachment: :blob).order(:title).select { |g| g.can_host?(current_user) }

  def given_scope(groups)
    managed = groups.select { |g| g.manageable_by?(current_user) }.map(&:id)
    ChipAward.where(group_id: groups.map(&:id)).where("given_by_id = ? OR group_id IN (?)", current_user.id, managed.presence || [0])
  end
end
