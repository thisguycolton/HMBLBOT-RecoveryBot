# Like, Love or Hugs on something a controller found as @reactable (Reactable): reacting
# again changes it, and its author hears about each person's first reaction.
module Reacting
  extend ActiveSupport::Concern

  private

  # `what` names it for the notification: "note", "comment"
  def save_reaction(what:, url:)
    kind = params[:kind].to_s
    return render(json: { error: "Pick Like, Love or Hugs." }, status: :unprocessable_entity) unless NoteReaction::KINDS.include?(kind)

    reaction = @reactable.reactions.find_or_initialize_by(user: current_user)
    first = reaction.new_record?
    reaction.update!(kind: kind)
    if first && @reactable.user_id != current_user.id
      Notification.deliver(@reactable.user, kind: "#{what}.reaction", title: "#{current_user.display_name} #{NoteReaction.phrase(kind)} your #{what}",
                                            body: @reactable.body.to_s.truncate(120), url: url, from: current_user)
    end
    yield
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  def remove_reaction
    @reactable.reactions.where(user: current_user).delete_all
    yield
  end
end
