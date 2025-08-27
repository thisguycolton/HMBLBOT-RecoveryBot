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

  # Provide a message if user is not confirmed
  def inactive_message
    confirmed? ? super : :unconfirmed
  end
end
