# Account settings > Sign-in methods (profile/SignInMethods.jsx): which ways they can sign in
# (a password, Google, Apple), Link and Unlink, and the choice to make after linking a Google
# or Apple account that another RecoveryBot account already has (LinksIdentities). Linking
# itself runs through the usual sign-in (OmniAuth Google, Sign in with Apple, the apps' sheets).
class Api::SignInMethodsController < ApplicationController
  include LinksIdentities
  before_action :authenticate_user!

  # GET /api/sign_in_methods
  def show
    render json: methods_json
  end

  # DELETE /api/sign_in_methods/:provider (google|apple). Never their last way in.
  def destroy
    provider = provider_param or return
    unless current_user.unlink_identity!(provider)
      return render(json: { error: "#{LABELS[provider]} is the only way you sign in. Choose a password or link another account first." },
                    status: :unprocessable_entity)
    end

    render json: methods_json.merge(message: "#{LABELS[provider]} is unlinked.")
  end

  # POST /api/sign_in_methods/move { delete_other: true|false }: after linking a Google or Apple
  # account another RecoveryBot account has, move it to this one (User#take_identity_from!)
  def move
    pending = pending_identity_move
    return render(json: { error: "That took too long. Please link it again." }, status: :unprocessable_entity) unless pending

    delete_other = ActiveModel::Type::Boolean.new.cast(params[:delete_other])
    error = current_user.take_identity_from!(pending[:other], pending[:provider], delete_other: delete_other)
    return render(json: { error: error }, status: :unprocessable_entity) if error

    forget_identity_move
    label = LABELS[pending[:provider]]
    UserMailer.sign_in_linked(current_user.reload, label).deliver_later
    render json: methods_json.merge(message: delete_other ? "#{label} is linked here, and the other account is deleted." : "#{label} is linked here now.")
  end

  # DELETE /api/sign_in_methods/move: leave both accounts as they are
  def cancel_move
    forget_identity_move
    render json: methods_json
  end

  private

  def provider_param
    provider = params[:provider].to_s.to_sym
    return provider if User::IDENTITY_COLUMNS.key?(provider)

    render(json: { error: "That isn't a sign-in we know." }, status: :not_found)
    nil
  end

  def methods_json
    user = current_user.reload
    ways = user.sign_in_ways
    {
      password: user.password_chosen, email: user.email,
      providers: LABELS.map do |provider, label|
        linked = user.identity_linked?(provider)
        { provider: provider, label: label, linked: linked, can_unlink: linked && ways != [provider], link: (link_option(provider) unless linked) }
      end,
      pending: pending_json,
    }
  end

  # How this page starts linking each one here: the app's own sheet, a form posted to the
  # website's sign-in, or nil when it isn't set up (or can't work: Google's page is blocked in the apps)
  def link_option(provider)
    native = NativeSignIn.options(native_platform) if native_app?
    case provider
    when :google
      if native then ({ kind: "native", client_id: native[:google_client_id] } if native[:google_client_id])
      elsif GoogleSignIn.path then { kind: "post", path: GoogleSignIn.path }
      end
    when :apple
      if native&.dig(:apple) then { kind: "native" }
      elsif AppleSignIn.path then { kind: "post", path: AppleSignIn.path }
      end
    end
  end

  def pending_json
    pending = pending_identity_move
    return unless pending

    other = pending[:other]
    others_ways = other.sign_in_ways
    {
      provider: pending[:provider], label: LABELS[pending[:provider]],
      other: {
        name: other.display_name, email: other.email, joined: other.created_at.to_date.iso8601,
        password: other.password_chosen, ways: others_ways.map { |w| w == :password ? "a password" : LABELS[w] },
        notes: other.timeline_notes.count, groups: other.group_memberships.count, chips: other.chip_awards.count,
      },
      # Its only way in, so moving it means deleting that account
      must_delete: others_ways == [pending[:provider]],
      # Someone else's link to an account with things in it that can't be deleted here
      blocked: others_ways == [pending[:provider]] && other.readings.exists?,
    }
  end
end
