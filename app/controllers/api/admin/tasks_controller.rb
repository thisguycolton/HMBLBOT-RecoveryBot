# Site Admin > Task board (SCRUMBLBOT; AdminTask). Every site admin can add, edit, give, take
# and move any task; deleting is for whoever made it (anyone can archive). The board's open
# pages are told about each change (AdminTasksChannel) and fetch #index again.
class Api::Admin::TasksController < Api::Admin::SuiteController
  before_action :find_task, except: %i[index create]

  # The whole board: columns, every task not archived (finished ones fold away after 30 days),
  # and the site admins tasks can be given to
  def index
    AdminTask.archive_old!
    tasks = AdminTask.visible.includes(:assignee, :creator, :completed_by).order(:position, :id).to_a
    comments = AdminTaskActivity.where(kind: "comment", admin_task_id: tasks.map(&:id)).group(:admin_task_id).count
    render json: {
      columns: AdminTaskColumn.ordered.map(&:as_api_json),
      tasks: tasks.map { |t| t.as_api_json(comments: comments[t.id].to_i) },
      admins: User.suite_admins.sort_by(&:display_name).map(&:as_person_json),
      me: current_user.id,
      today: AdminTask.today.iso8601,
    }
  end

  def show
    render json: full(@task)
  end

  # POST { title, notes, priority, due_on, link_path, checklist, tags, column_id, assignee_id, for_all_admins }
  def create
    column = AdminTaskColumn.find_by(id: params[:column_id]) || AdminTaskColumn.first_start
    task = AdminTask.new(task_params.merge(column: column, creator: current_user, position: 0))
    task.assignee = User.find_by(id: params[:assignee_id]) if params[:assignee_id].present?
    task.for_all_admins = ActiveModel::Type::Boolean.new.cast(params[:for_all_admins]) || false
    AdminTask.transaction do
      task.save!
      task.record!(current_user, "created")
      task.send(:place!, column, 0)
      task.update!(completed_at: Time.current, completed_by: current_user) if column.finished?
    end
    AdminTaskNotices.assigned(task, current_user) if task.assignee || task.for_all_admins
    render json: full(task), status: :created
  rescue ActiveRecord::RecordInvalid
    render_errors(task)
  end

  # PATCH { title, notes, priority, due_on, link_path, checklist, tags, archived }
  def update
    @task.assign_attributes(task_params)
    @task.archived_at = (ActiveModel::Type::Boolean.new.cast(params[:archived]) ? Time.current : nil) if params.key?(:archived)
    changed = @task.changed & %w[title notes priority due_on link_path tags]
    archiving = @task.will_save_change_to_archived_at?
    return render_errors(@task) unless @task.save

    @task.record!(current_user, "edited", data: { fields: changed }) if changed.any?
    @task.send(:renumber, @task.admin_task_column_id) if archiving
    render json: full(@task)
  end

  def destroy
    return render json: { error: "Only whoever made this task can delete it. You can archive it instead." }, status: :forbidden if @task.creator_id && @task.creator_id != current_user.id

    column_id = @task.admin_task_column_id
    @task.destroy!
    AdminTask.new.send(:renumber, column_id)
    head :no_content
  end

  def take = act { @task.take!(current_user) }
  def let_go = act { @task.let_go!(current_user) }
  def complete = act { @task.complete!(current_user) }
  def reopen = act { @task.reopen!(current_user) }

  # POST { assignee_id (blank = nobody), all: true|false }
  def give
    user = params[:assignee_id].present? ? User.find(params[:assignee_id]) : nil
    return render json: { error: "Tasks can only be given to site admins." }, status: :unprocessable_entity if user && !user.suite_admin?

    act { @task.give!(user, all: ActiveModel::Type::Boolean.new.cast(params[:all]) || false, by: current_user) }
  end

  # POST { column_id, index (0 = top) }
  def move
    column = AdminTaskColumn.find(params[:column_id])
    act { @task.move_to!(column, params[:index].to_i, by: current_user) }
  end

  # POST { body }
  def comment
    activity = @task.activities.new(user: current_user, kind: "comment", body: params[:body].to_s.strip)
    return render_errors(activity) unless activity.save

    AdminTaskNotices.comment(@task, activity)
    AdminTasksChannel.changed
    render json: full(@task.reload), status: :created
  end

  private

  def find_task
    @task = AdminTask.find(params[:id])
  end

  def act
    yield
    render json: full(@task.reload)
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  def full(task)
    task.as_api_json(comments: task.activities.where(kind: "comment").count, full: true)
  end

  def task_params
    params.permit(:title, :notes, :priority, :due_on, :link_path, checklist: %i[id text done], tags: []).to_h.tap do |p|
      %i[checklist tags].each { |key| params.key?(key) ? p[key] = Array(p[key]) : p.delete(key) }
    end
  end
end
