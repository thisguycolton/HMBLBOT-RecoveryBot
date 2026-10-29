# Your own profile (/users/edit): name, picture, a short blurb, and account details
class Api::ProfilesController < ApplicationController
  before_action :authenticate_user!

  # GET /api/profile
  def show
    render json: profile_json
  end

  # PATCH /api/profile (multipart when a picture is uploaded)
  # name, bio, avatar, remove_avatar=1, sobriety_date, show_sobriety_date, username,
  # default_highlight_visibility, default_note_visibility; email or password also need current_password.
  # gratitude_reminder, gratitude_reminder_at, step_reminder, step_reminder_at ("HH:MM"), time_zone.
  # Hosts (User#host?) also: host_reminders, host_reminder_hours, host_reminder_email
  def update
    user = current_user
    attrs = params.require(:profile).permit(:name, :bio, :avatar, :sobriety_date, :show_sobriety_date, :username, :default_highlight_visibility, :default_note_visibility, :email, :password, :password_confirmation, :current_password,
                                            :host_reminders, :host_reminder_hours, :host_reminder_email,
                                            :gratitude_reminder, :gratitude_reminder_at, :step_reminder, :step_reminder_at, :time_zone)
    user.avatar.purge_later if ActiveModel::Type::Boolean.new.cast(params.dig(:profile, :remove_avatar)) && attrs[:avatar].blank?

    attrs[:username] = attrs[:username].to_s.strip.downcase if attrs.key?(:username)
    profile = %i[name bio avatar sobriety_date show_sobriety_date username default_highlight_visibility default_note_visibility
                 gratitude_reminder gratitude_reminder_at step_reminder step_reminder_at time_zone]
    profile += %i[host_reminders host_reminder_hours host_reminder_email] if user.host?
    account_change = attrs[:email].present? && attrs[:email].strip.casecmp?(user.email) == false || attrs[:password].present?
    saved = if account_change
              user.update_with_password(attrs.slice(*profile, :email, :password, :password_confirmation, :current_password))
            else
              user.update(attrs.slice(*profile))
            end
    return render(json: { error: user.errors.full_messages.to_sentence }, status: :unprocessable_entity) unless saved

    bypass_sign_in(user) if attrs[:password].present?
    render json: profile_json
  end

  # DELETE /api/profile { current_password }
  # Deletes the account and what's only theirs (profile, notes, highlights, follows, RSVPs,
  # memberships); group records they helped keep stay with the group, without their name
  # attached where the record allows it. Signs them out.
  def destroy
    user = current_user
    unless user.valid_password?(params[:current_password].to_s)
      return render(json: { error: "That password isn't right." }, status: :unprocessable_entity)
    end

    if user.readings.exists?
      return render(json: { error: "You've added readings to the archive, and other people use them. Please use the Contact page and we'll delete your account and sort out the readings with you." },
                    status: :unprocessable_entity)
    end

    unless user.destroy
      return render(json: { error: user.errors.full_messages.to_sentence.presence || "Your account couldn't be deleted. Please use the Contact page and we'll do it for you." },
                    status: :unprocessable_entity)
    end

    sign_out(user)
    head :no_content
  end

  private

  def profile_json
    u = current_user.reload
    {
      name: u.name, email: u.email, unconfirmed_email: u.unconfirmed_email, bio: u.bio, avatar_url: u.avatar_url,
      sobriety_date: u.sobriety_date&.iso8601, show_sobriety_date: u.show_sobriety_date,
      groups: u.group_memberships.includes(:group).map { |m| { slug: m.group.slug, title: m.group.title, role: m.role, status: m.status } },
      groups_open: Group.feature_open_to?(u),
      username: u.username, profile_path: u.profile_path, profiles_open: User.profiles_open_to?(u),
      default_highlight_visibility: u.default_highlight_visibility, default_note_visibility: u.default_note_visibility,
      hosting: hosting_json(u),
      reminders: {
        gratitude: { on: u.gratitude_reminder, at: u.gratitude_reminder_at },
        step: { on: u.step_reminder, at: u.step_reminder_at },
        time_zone: u.time_zone,
      },
    }
  end

  # Only for hosts and co-hosts: their reminder settings and the next few dates they're on
  def hosting_json(user)
    commitments = HostCommitments.new(user)
    return unless commitments.host?

    {
      reminders: user.host_reminders, hours: user.host_reminder_hours, email: user.host_reminder_email, hour_options: User::HOST_REMINDER_HOURS,
      groups: commitments.groups.map { |g| { slug: g.slug, title: g.title } },
      upcoming: commitments.upcoming(to: Time.current + 3.weeks).first(6).map do |c|
        { meeting: c.meeting.name, group: c.meeting.group.title, slug: c.meeting.group.slug, role: c.role, on: c.on.iso8601,
          time: c.starts_at.strftime("%-I:%M %p %Z"), cover: c.cover }
      end,
    }
  end
end
