class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_one :user_active_group

  has_many :user_highlights, dependent: :destroy
  has_many :text_reports, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :text_report_comments, dependent: :destroy
  has_many :resolved_text_reports, class_name: "TextReport", foreign_key: :resolved_by_id, dependent: :nullify
  has_many :schedule_polls, dependent: :destroy
  has_many :schedule_poll_members, dependent: :destroy
  has_many :schedule_poll_ballots, dependent: :nullify

  # Set default values for new users
  after_initialize :set_defaults, unless: :persisted?
  after_create_commit :notify_admins_of_signup, unless: :confirmed?

  def set_defaults
    self.admin ||= false
    self.confirmed ||= false
  end

  # New sign-ups wait for an admin to approve them in the admin suite's Users page
  def notify_admins_of_signup
    Notification.deliver(User.suite_admins, kind: "user.pending", title: "#{name.presence || email} is waiting for approval",
                                            url: "/admin_panel/users")
  end

  # Only allow confirmed users to sign in
  def active_for_authentication?
    super && confirmed?
  end

  # The admin suite (/admin_panel) shows members' attendance records, visits and accounts, so
  # being an admin isn't enough: the email must also be in ADMIN_EMAILS (comma-separated;
  # COURT_VERIFICATION_ADMIN_EMAILS is still read for older setups). Unset means nobody.
  # Everyone who can use the admin suite (see #suite_admin?)
  def self.suite_admins
    where(admin: true).select(&:suite_admin?)
  end

  def suite_admin?
    allowed = (ENV["ADMIN_EMAILS"].presence || ENV["COURT_VERIFICATION_ADMIN_EMAILS"]).to_s
                .split(",").map { |e| e.strip.downcase }
    admin? && allowed.include?(email.to_s.downcase)
  end

  # Provide a message if user is not confirmed
  def inactive_message
    confirmed? ? super : :unconfirmed
  end
end
