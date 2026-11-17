# The columns of Site Admin > Task board (AdminTaskColumn): add, rename, change what a column
# means, reorder, remove (only when it's empty and the board stays whole).
class Api::Admin::TaskColumnsController < Api::Admin::SuiteController
  # POST { name, kind } lands just before the Done column
  def create
    column = AdminTaskColumn.new(name: params[:name], kind: params[:kind].presence || "doing")
    return render json: { errors: ["The board already has a Done column."] }, status: :unprocessable_entity if column.finished?

    AdminTaskColumn.transaction do
      return render_errors(column) unless column.save

      reorder(column, AdminTaskColumn.ordered.where.not(id: column.id).index { |c| c.finished? } || AdminTaskColumn.count)
    end
    AdminTasksChannel.changed
    render json: { columns: AdminTaskColumn.ordered.map(&:as_api_json) }, status: :created
  end

  # PATCH { name, kind, index }
  def update
    column = AdminTaskColumn.find(params[:id])
    column.name = params[:name] if params.key?(:name)
    column.kind = params[:kind] if params.key?(:kind)
    AdminTaskColumn.transaction do
      return render_errors(column) unless column.save

      reorder(column, params[:index].to_i) if params.key?(:index)
    end
    AdminTasksChannel.changed
    render json: { columns: AdminTaskColumn.ordered.map(&:as_api_json) }
  end

  def destroy
    column = AdminTaskColumn.find(params[:id])
    if (problem = column.removal_problem)
      return render json: { errors: [problem] }, status: :unprocessable_entity
    end

    column.destroy!
    AdminTasksChannel.changed
    render json: { columns: AdminTaskColumn.ordered.map(&:as_api_json) }
  end

  private

  def reorder(column, index)
    list = AdminTaskColumn.ordered.where.not(id: column.id).to_a
    list.insert(index.clamp(0, list.size), column)
    list.each_with_index { |c, i| c.update_columns(position: i + 1) unless c.position == i + 1 }
  end
end
