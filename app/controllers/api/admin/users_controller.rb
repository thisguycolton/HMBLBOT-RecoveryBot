# Accounts for the admin suite: search, confirm someone whose email never arrived, grant or remove
# admin, delete an account.
class Api::Admin::UsersController < Api::Admin::SuiteController
  LIMIT = 200

  # GET ?q=&filter=pending|admins
  def index
    users = User.order(created_at: :desc)
    if params[:q].present?
      q = "%#{User.sanitize_sql_like(params[:q].strip)}%"
      users = users.where("email ILIKE ? OR name ILIKE ?", q, q)
    end
    users = users.where(confirmed: [false, nil]) if params[:filter] == "pending"
    users = users.where(admin: true) if params[:filter] == "admins"

    total = users.count
    users = users.limit(LIMIT).to_a
    ids = users.map(&:id)
    readings = Reading.where(user_id: ids).group(:user_id).count
    last_seen = Ahoy::Visit.where(user_id: ids).group(:user_id).maximum(:started_at)

    render json: {
      total: total,
      limit: LIMIT,
      users: users.map { |u| user_json(u, readings[u.id].to_i, last_seen[u.id]) },
    }
  end

  # PATCH { admin: true|false }. You can't change your own admin flag.
  def update
    user = User.find(params[:id])
    return render json: { error: "You can't change your own admin access." }, status: :unprocessable_entity if user == current_user

    user.update!(admin: ActiveModel::Type::Boolean.new.cast(params.require(:admin)))
    render json: user_json(user)
  end

  # PATCH: confirm a sign-up by hand (their confirmation email never arrived) and email them
  def confirm
    user = User.find(params[:id])
    if user.confirm
      UserMailer.approval_notification(user).deliver_later
      Notification.deliver(user, kind: "user.approved", title: "Your account was approved. Welcome to HumbleBot!")
      render json: user_json(user)
    else
      render_errors(user)
    end
  end

  # DELETE { confirm_email }: delete someone's account for good, the same as deleting their own
  # (User#destroy, which also revokes Sign in with Apple). Readings they added to the archive are
  # used by others, so they move to the admin doing this instead of blocking it. Not yourself, and
  # not another admin (remove their admin access first).
  def destroy
    user = User.find(params[:id])
    return render json: { error: "You can't delete your own account here. Use Account settings." }, status: :unprocessable_entity if user == current_user
    return render json: { error: "Remove their admin access first." }, status: :unprocessable_entity if user.admin
    unless params[:confirm_email].to_s.strip.casecmp?(user.email)
      return render json: { error: "Type their email address to confirm." }, status: :unprocessable_entity
    end

    deleted = User.transaction do
      user.readings.update_all(user_id: current_user.id)
      user.destroy || raise(ActiveRecord::Rollback)
    end
    return render_errors(user) unless deleted

    Rails.logger.info("[admin] #{current_user.email} deleted account ##{user.id} (#{user.email})")
    head :no_content
  end

  # GET: why someone isn't getting a reminder or push. Their reminders and time zone, which app
  # installs and browsers are signed up for notifications (and when each was last sent one), what
  # kinds they turned off, and their latest bell notifications. Nothing they wrote.
  def notifications
    user = User.find(params[:id])
    local = Time.current.in_time_zone(user.zone)
    today = local.to_date
    reminders = RecoveryReminders::KINDS.to_h do |which, k|
      [which, { on: !!user.public_send("#{which}_reminder"), at: user.public_send("#{which}_reminder_at"),
                reminded_on: user.public_send("#{which}_reminded_on")&.iso8601,
                written_today: k[:model].where(user: user, on: today).exists? }]
    end
    render json: {
      time_zone: user.zone.tzinfo.name, time_zone_saved: user.time_zone.present?, local_time: local.strftime("%a %b %-d, %-l:%M %p"),
      reminders: reminders,
      app_push_ready: FcmSender.configured?, web_push_ready: WebPushSender.configured?,
      reminders_pushed: user.wants_push?("recovery.step_reminder"),
      turned_off: user.push_categories.reject { |c| c[:on] }.map { |c| c[:label] },
      apps: user.device_tokens.order(created_at: :desc).map do |d|
        { label: d.label, app_version: d.app_version, created_at: d.created_at.iso8601, updated_at: d.updated_at.iso8601, last_sent_at: d.last_sent_at&.iso8601 }
      end,
      browsers: user.push_subscriptions.order(created_at: :desc).map { |s| s.as_api_json.slice(:label, :created_at, :last_sent_at) },
      recent: user.notifications.recent.limit(8).map { |n| n.as_api_json.slice(:title, :kind, :read, :created_at) },
    }
  end

  private

  def user_json(user, readings_count = nil, last_seen = nil)
    {
      id: user.id,
      email: user.email,
      name: user.name,
      admin: !!user.admin,
      confirmed: !!user.confirmed,
      created_at: user.created_at.iso8601,
      readings_count: readings_count,
      last_seen_at: last_seen&.iso8601,
      is_you: user == current_user,
    }
  end
end
