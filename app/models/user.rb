class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_one :user_active_group

  has_many :user_highlights, dependent: :destroy

  # Set default values for new users
  after_initialize :set_defaults, unless: :persisted?

  def set_defaults
    self.admin ||= false
    self.confirmed ||= false
  end

  # Only allow confirmed users to sign in
  def active_for_authentication?
    super && confirmed?
  end

  # Court verifications hold members' attendance records, so only the admins named in
  # COURT_VERIFICATION_ADMIN_EMAILS (comma-separated) may look them up. Unset means nobody.
  def court_verification_admin?
    allowed = ENV["COURT_VERIFICATION_ADMIN_EMAILS"].to_s.split(",").map { |e| e.strip.downcase }
    admin? && allowed.include?(email.to_s.downcase)
  end

  # Provide a message if user is not confirmed
  def inactive_message
    confirmed? ? super : :unconfirmed
  end
end
