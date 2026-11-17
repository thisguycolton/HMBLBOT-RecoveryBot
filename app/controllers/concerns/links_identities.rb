# Linking Google or Apple to the signed-in account from Account settings (Api::SignInMethodsController
# lists them). The sign-in itself runs as usual (OmniAuth Google, Sign in with Apple on the
# website, the apps' sheets); when it was started from settings, its controller hands the
# checked uid here instead of signing someone in with User.from_identity.
#
# If another account already has that Google or Apple account (often a second account Apple's
# "Hide My Email" made), nothing changes yet: the session remembers what they proved for a few
# minutes, and settings ask whether to move it here (Api::SignInMethodsController#move).
module LinksIdentities
  extend ActiveSupport::Concern

  PENDING_KEY = :identity_move
  PENDING_TTL = 10.minutes
  LABELS = { google: "Google", apple: "Apple" }.freeze
  SETTINGS_PATH = "/users/edit#account".freeze

  # Links it and returns what happened (User#link_identity), with a sentence to show them
  def link_identity_for(user, provider, uid)
    result = user.link_identity(provider, uid)
    label = LABELS.fetch(provider)
    message = case result
              when :linked
                UserMailer.sign_in_linked(user, label).deliver_later
                "#{label} is linked. You can sign in with it now."
              when :already then "That #{label} account is already linked to yours."
              when :other_linked then "A different #{label} account is linked already. Unlink it first, then link this one."
              when :taken
                other = User.find_by(User::IDENTITY_COLUMNS.fetch(provider) => uid.to_s)
                session[PENDING_KEY] = { "provider" => provider.to_s, "uid" => uid.to_s, "other_id" => other&.id, "at" => Time.current.to_i }
                "That #{label} account belongs to another RecoveryBot account. Choose below what to do."
              end
    [result, message]
  end

  # What they proved and haven't decided on yet, if it's still fresh: { provider:, uid:, other: }
  def pending_identity_move
    saved = session[PENDING_KEY]
    return unless saved.is_a?(Hash) && Time.current.to_i - saved["at"].to_i < PENDING_TTL
    return unless User::IDENTITY_COLUMNS.key?(saved["provider"].to_s.to_sym)

    provider = saved["provider"].to_sym
    other = User.find_by(id: saved["other_id"], User::IDENTITY_COLUMNS.fetch(provider) => saved["uid"])
    { provider: provider, uid: saved["uid"], other: other } if other && other != current_user
  end

  def forget_identity_move = session.delete(PENDING_KEY)
end
