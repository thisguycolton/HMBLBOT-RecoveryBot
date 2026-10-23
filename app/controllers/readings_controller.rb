class ReadingsController < ApplicationController
  include KeepsRobotsOut
  keep_robots_out except: :show
  before_action :authenticate_user!, only: %i[ mine new create edit update destroy ]
  before_action :set_reading, only: %i[ show edit update destroy ]
  before_action :authorize_owner!, only: %i[ edit update destroy ]
  # A shared reading's link shows its title and card in Messages and the like; its text stays for people
  before_action :answer_robots, only: :show
  after_action :tag_noindex, only: :show
  layout "reader", only: %i[new index show edit mine]
  READINGS_PER_PAGE = 24


  def index
    @readings = Reading.published.includes(:tags).order(created_at: :desc)

    # Qualify columns: the tag filter below joins `tags`, which also has a `title`
    if params[:q].present?
      like = "%#{Reading.sanitize_sql_like(params[:q].strip)}%"
      @readings = @readings.where("readings.title ILIKE :q OR readings.source ILIKE :q", q: like)
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
  
    # Themes to browse: the ones with published readings, with how many each has (the
    # archive shows the most used first and the rest behind "Show more")
    counts = Tag.joins(:readings).merge(Reading.published).group("tags.id").distinct.count("readings.id")
    @tags_json = Tag.where(id: counts.keys).or(Tag.where(id: @selected_tag&.id)).order(:title).map do |tag|
      { id: tag.id, title: tag.title, slug: tag.slug, icon_name: tag.icon_name, count: counts[tag.id].to_i }
    end

    # A page of cards at a time, with their text loaded in bulk
    @total = @readings.count
    @pages = [(@total / READINGS_PER_PAGE.to_f).ceil, 1].max
    @page = params[:page].to_i.clamp(1, @pages)
    @readings_json = @readings.includes(:rich_text_content, :richer_text_richer_content)
                              .offset((@page - 1) * READINGS_PER_PAGE).limit(READINGS_PER_PAGE)
                              .map { |reading| reading_card_json(reading) }
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
    @share = ShareMeta.safely { ShareMeta.reading(@reading) }
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

  def answer_robots
    return unless robot_request?

    share = link_preview_request? && !request.format.json? && ShareMeta.safely { ShareMeta.reading(@reading) }
    share ? link_preview(share) : turn_robots_away
  end

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
