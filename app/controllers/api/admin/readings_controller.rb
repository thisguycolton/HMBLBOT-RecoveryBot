# Every reading, whoever wrote it: search, publish / unpublish / schedule, delete.
class Api::Admin::ReadingsController < Api::Admin::SuiteController
  LIMIT = 200

  # GET ?q=&status=published|scheduled|draft
  def index
    readings = Reading.includes(:user, :tags).order(updated_at: :desc)
    readings = readings.where("readings.title ILIKE ?", "%#{Reading.sanitize_sql_like(params[:q].strip)}%") if params[:q].present?
    readings = case params[:status]
               when "published" then readings.published
               when "scheduled" then readings.scheduled
               when "draft" then readings.drafts
               else readings
               end

    render json: { total: readings.count, limit: LIMIT, readings: readings.limit(LIMIT).map { |r| reading_json(r) } }
  end

  # PATCH { publish: "now" | "unpublish" } or { published_at: ISO time } to schedule
  def update
    reading = Reading.find(params[:id])
    case params[:publish]
    when "now" then reading.publish!
    when "unpublish" then reading.unpublish!
    else
      at = Time.zone.parse(params[:published_at].to_s)
      return render json: { error: "Pick a date and time to publish." }, status: :unprocessable_entity unless at
      reading.schedule_publish!(at)
    end
    render json: reading_json(reading)
  end

  def destroy
    Reading.find(params[:id]).destroy!
    head :no_content
  end

  private

  def reading_json(reading)
    {
      id: reading.id,
      title: reading.title,
      status: reading.draft? ? "draft" : reading.scheduled_for_later? ? "scheduled" : "published",
      published_at: reading.published_at&.iso8601,
      updated_at: reading.updated_at.iso8601,
      author: reading.user&.name.presence || reading.user&.email,
      source: reading.source,
      tags: reading.tags.map { |t| { id: t.id, title: t.title, icon_name: t.icon_name } },
      path: "/readings/#{reading.id}",
      edit_path: "/readings/#{reading.id}/edit",
    }
  end
end
