# Sending a gratitude list or 10th step to your sponsors (SponsorshipShare), taking one back,
# and the sponsor's one short note on it
class Api::SponsorshipSharesController < ApplicationController
  before_action :authenticate_user!

  # POST /api/sponsorship_shares { sponsorship_ids: [], kind, on, title, body }
  def create
    sponsorships = Sponsorship.active.where(sponsee_id: current_user.id, id: Array(params[:sponsorship_ids])).includes(:sponsor).to_a
    return render(json: { error: "Pick who to send it to." }, status: :unprocessable_entity) if sponsorships.empty?

    on = StepInventory.parse_day(params[:on])
    sent = SponsorshipShare.transaction do
      sponsorships.map do |s|
        # Sent again before they opened it: the newer one takes its place
        same = s.shares.where(kind: params[:kind].to_s, on: on, seen_at: nil)
        same = same.where(title: params[:title].to_s.squish) if params[:kind].to_s == "step_work" # one per worksheet
        share = same.first_or_initialize
        share.update!(title: params[:title], body: params[:body])
        share
      end
    end
    sponsorships.each do |s|
      Notification.deliver(s.sponsor, kind: "sponsorship.share", from: current_user,
                                      title: "#{current_user.display_name} sent you their #{SponsorshipShare::KINDS[params[:kind].to_s]}",
                                      url: "/recovery/sponsorship/#{s.id}")
    end
    render json: { shares: sent.map(&:as_api_json), sent_to: sponsorships.map { |s| s.sponsor.display_name } }, status: :created
  end

  # PATCH /api/sponsorship_shares/:id { reply } (the sponsor)
  def update
    share = SponsorshipShare.joins(:sponsorship).merge(Sponsorship.active.where(sponsor_id: current_user.id)).find_by(id: params[:id])
    return render(json: { error: "That isn't one of yours." }, status: :not_found) unless share

    first = share.reply.blank?
    share.update!(reply: params[:reply], replied_at: Time.current, seen_at: share.seen_at || Time.current)
    if first && share.reply.present?
      Notification.deliver(share.sponsorship.sponsee, kind: "sponsorship.reply", from: current_user,
                                                      title: "#{current_user.display_name} left a note on your #{SponsorshipShare::KINDS[share.kind]}",
                                                      body: share.reply, url: "/recovery/sponsorship/#{share.sponsorship_id}")
    end
    render json: { share: share.as_api_json }
  end

  # DELETE /api/sponsorship_shares/:id (the sponsee takes it back)
  def destroy
    share = SponsorshipShare.joins(:sponsorship).merge(Sponsorship.where(sponsee_id: current_user.id)).find_by(id: params[:id])
    return render(json: { error: "That isn't one of yours." }, status: :not_found) unless share

    share.destroy!
    head :no_content
  end
end
