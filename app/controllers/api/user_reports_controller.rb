# Members report someone to the site admins (UserReport): a chat message, note or comment of
# theirs they can see, or the person. Admins review them in the admin suite.
class Api::UserReportsController < ApplicationController
  before_action :authenticate_user!

  # POST /api/user_reports { subject_type: chat_message|timeline_note|note_comment, subject_id | user_id, reason }
  def create
    report = UserReport.new(reporter: current_user, reason: params[:reason].to_s.strip)
    if (klass = UserReport::SUBJECTS[params[:subject_type].to_s])
      subject = klass.constantize.find(params[:subject_id])
      raise ActiveRecord::RecordNotFound unless visible?(subject)

      report.assign_attributes(user: subject.user, subject_type: klass, subject_id: subject.id, quote: subject.body.to_s.first(4000),
                               group: subject.try(:group), where_label: where_label(subject))
    else
      report.user = User.find(params[:user_id])
      report.where_label = "Their profile"
    end
    return render(json: { error: "You can't report yourself." }, status: :unprocessable_entity) if report.user == current_user
    return render(json: { error: report.errors.full_messages.to_sentence }, status: :unprocessable_entity) unless report.save

    head :created
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Not found." }, status: :not_found
  end

  private

  def visible?(subject)
    case subject
    when ChatMessage then subject.chat_channel.readable_by?(current_user)
    when TimelineNote then subject.visible_to?(current_user)
    when NoteComment then subject.timeline_note.visible_to?(current_user)
    end
  end

  def where_label(subject)
    case subject
    when ChatMessage then "##{subject.chat_channel.name} in #{subject.group.title}"
    when TimelineNote then "A note"
    when NoteComment then "A comment on a note"
    end
  end
end
