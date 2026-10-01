require "csv"

# Court attendance verifications for the admin lookup (AdminPanel::CourtVerificationsController).
# Every action takes the same filters: name, email, from, to (see CourtVerification.filtered).
class Api::Admin::CourtVerificationsController < Api::Admin::SuiteController
  # the page lists this many; CSV, print and email take every match up to BUNDLE_LIMIT
  LIST_LIMIT = 200
  BUNDLE_LIMIT = 500

  def index
    respond_to do |format|
      format.json do
        render json: {
          total: matches.count,
          limit: LIST_LIMIT,
          court_verifications: matches.limit(LIST_LIMIT).map(&:as_admin_json),
        }
      end
      format.csv do
        send_data to_csv(matches.reorder(:meeting_at).limit(BUNDLE_LIMIT)),
                  type: "text/csv", filename: "court-verifications-#{Date.current.iso8601}.csv"
      end
    end
  end

  # POST { recipient, name, email, from, to } -> one email holding every matching verification
  def send_bundle
    recipient = params[:recipient].to_s.strip
    unless recipient.match?(URI::MailTo::EMAIL_REGEXP)
      return render json: { error: "Enter a valid email address to send to." }, status: :unprocessable_entity
    end

    ids = matches.reorder(:meeting_at).limit(BUNDLE_LIMIT + 1).pluck(:id)
    return render json: { error: "No verifications match these filters." }, status: :unprocessable_entity if ids.empty?
    if ids.size > BUNDLE_LIMIT
      return render json: { error: "That's more than #{BUNDLE_LIMIT} verifications. Narrow the filters first." }, status: :unprocessable_entity
    end

    CourtVerificationMailer.with(recipient: recipient, ids: ids).bundle_email.deliver_later
    render json: { sent: ids.size, recipient: recipient }
  end

  private

  def matches
    @matches ||= CourtVerification.filtered(**params.permit(:name, :email, :from, :to).to_h.symbolize_keys)
                                  .order(meeting_at: :desc)
  end

  def to_csv(verifications)
    CSV.generate do |csv|
      csv << ["Meeting (Phoenix time)", "Name", "Email", "Topic", "Host", "Signed by", "Requested at"]
      verifications.each do |v|
        csv << [v.meeting_time_label, v.respondent_name, v.respondent_email, v.topic, v.host_name, v.signer_name,
                v.created_at.in_time_zone(CourtVerification::TIME_ZONE).strftime("%Y-%m-%d %-I:%M %p")]
      end
    end
  end
end
