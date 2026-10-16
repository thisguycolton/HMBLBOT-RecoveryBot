class ReadingsController < ApplicationController
  include KeepsRobotsOut
  keep_robots_out
  before_action :authenticate_user!, only: %i[ mine new create edit update destroy ]
  before_action :set_reading, only: %i[ show edit update destroy ]
  before_action :authorize_owner!, only: %i[ edit update destroy ]
  layout "reader", only: %i[new index show edit mine]


  def index
    @readings = Reading.published.includes(:tags).order(created_at: :desc)

    # Qualify columns: the tag filter below joins `tags`, which also has a `title`
    if params[:q].present?
      @readings = @readings.where("readings.title ILIKE ?", "%#{Reading.sanitize_sql_like(params[:q])}%")
    end

    if params[:tag].present?
      @selected_tag = Tag.find_by(slug: params[:tag]) || Tag.find_by(title: params[:tag])
  
      if @selected_tag
        @readings = @readings
          .joins(:tags)
          .where(tags: { id: @selected_tag.id })
          .distinct
      else
        @readings = @readings.none
      end
    end
  
    @tags = Tag.order(:title)
    # Pass all tags for theme browsing
    @tags_json = @tags.map do |tag|
        { id: tag.id, title: tag.title, slug: tag.slug, icon_name: tag.icon_name }
    end

    @readings_json = @readings.map { |reading| reading_card_json(reading) }
  end

  # GET /readings/mine
  # The signed-in user's own readings in every state: published, scheduled, and drafts
  def mine
    @readings_json = Reading.where(user: current_user).includes(:tags).order(updated_at: :desc).map do |reading|
      reading_card_json(reading).merge(
        status: reading_status(reading),
        published_at: reading.published_at&.iso8601,
        updated_at: reading.updated_at.iso8601,
        edit_path: edit_reading_path(reading),
        destroy_path: reading_path(reading)
      )
    end
  end

  # GET /readings/1 or /readings/1.json
  def show
    # Drafts and future-scheduled readings are only visible to their owner and admins
    unless @reading.published? || current_user&.admin? || (current_user && @reading.user_id == current_user.id)
      alert = @reading.scheduled_for_later? ? "Reading is scheduled for later." : "Reading is not published yet."
      redirect_to readings_path, alert: alert
      return
    end

    ahoy.track "Viewed Reading", title: @reading.title
  end

  # GET /readings/new
  def new
    @reading = Reading.new
    @polls = Poll.all.order(updated_at: :desc)
  end

  # GET /readings/1/edit
  def edit
    hour = @reading.meetingTime&.strftime("%-l")
    minute = @reading.meetingTime&.strftime("%M")
    meridiem = @reading.meetingTime&.strftime("%p")
    content = @reading.content&.body&.to_html
    topic = @reading.topic&.body&.to_s
  end

  # POST /readings or /readings.json
def create
  @reading = Reading.new(reading_params)
  @reading.user = current_user
  @reading.group_id = reading_group_id(@reading.group_id) || default_group_id
  remember_group(@reading.group_id)

  if @reading.save
    render json: { id: @reading.id }, status: :created
  else
    render json: { errors: @reading.errors.full_messages }, status: :unprocessable_entity
  end
end

def update
  @reading.assign_attributes(reading_params)
  @reading.group_id = reading_group_id(@reading.group_id) if @reading.group_id_changed?
  remember_group(@reading.group_id) if @reading.group_id_changed?

  if @reading.save
    render json: { id: @reading.id }, status: :ok
  else
    render json: { errors: @reading.errors.full_messages }, status: :unprocessable_entity
  end
end

  # DELETE /readings/1 or /readings/1.json
  def destroy
    @reading.destroy

    respond_to do |format|
      format.html { redirect_to mine_readings_path, notice: "Reading was successfully deleted." }
      format.json { head :no_content }
    end
  end

  private

  # A reading can only be tagged to a group its author is in (admins: any group)
  def reading_group_id(id)
    return nil if id.blank?
    return id if current_user.suite_admin? && Group.exists?(id)

    current_user.groups.where(id: id).pick(:id)
  end

  # The group new readings default to: the last one used, else their only group
  def default_group_id
    active = current_user.user_active_group&.group_id
    return active if active && current_user.groups.exists?(id: active)

    ids = current_user.groups.limit(2).pluck(:id)
    ids.one? ? ids.first : nil
  end

  def remember_group(group_id)
    return unless group_id && current_user.groups.exists?(id: group_id)

    active = UserActiveGroup.find_or_initialize_by(user: current_user)
    active.update!(group_id: group_id)
  end

  helper_method def reading_editor_user_json
    groups = current_user.groups.includes(:meetings).order(:title)
    active_id = (@reading&.group_id if @reading&.persisted?) || default_group_id
    {
      id: current_user.id,
      name: current_user.name,
      groups: groups.map { |g| { id: g.id, title: g.title, meetingLink: g.meetings.map(&:conference_url).compact.first } },
      groups_open: Group.feature_open_to?(current_user),
      user_active_group: (g = groups.find { |x| x.id == active_id }) && {
        group: { id: g.id, title: g.title, meetingLink: g.meetings.map(&:conference_url).compact.first },
      },
    }
  end
    # Use callbacks to share common setup or constraints between actions.
    def set_reading
      @reading = Reading.find(params[:id])
    end

    # Only the reading's owner or an admin may change it
    def authorize_owner!
      return if current_user.admin? || @reading.user_id == current_user.id

      respond_to do |format|
        format.html { redirect_to reading_path(@reading), alert: "You can only change your own readings." }
        format.json { render json: { errors: ["You can only change your own readings."] }, status: :forbidden }
      end
    end

    def reading_status(reading)
      if reading.draft? then "draft"
      elsif reading.scheduled_for_later? then "scheduled"
      else "published"
      end
    end

    def reading_card_json(reading)
      text =
        if reading.richer_content&.id.present?
          reading.richer_content.to_plain_text
        elsif reading.content.present?
          reading.content.to_plain_text
        else
          ""
        end

      {
        id: reading.id,
        title: reading.title,
        source: reading.source,
        host: reading.host,
        meetingName: reading.meetingName,
        meetingUrl: reading.meetingUrl,
        meetingDate: reading.meetingDate,
        meetingTime: reading.meetingTime&.strftime("%H:%M:%S"),
        preview: text.truncate(500),
        meeting_date_iso: reading.meetingDate&.iso8601,
        path: reading_path(reading),
        tags: reading.tags.map { |tag|
          { id: tag.id, title: tag.title, slug: tag.slug, icon_name: tag.icon_name }
        }
      }
    end

    # Only allow a list of trusted parameters through.
    def reading_params
      params.require(:reading).permit(:title, :content, :topic, :meetingTime, :meetingDate, :source, :meetingName, :meetingUrl, :host, :hour, :minute, :meridiem, :group_id, :richer_content, :published_at, tag_ids: [])
    end
end
