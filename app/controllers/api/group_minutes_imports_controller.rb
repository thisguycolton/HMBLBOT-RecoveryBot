# Bringing old minutes in from Word files (app/services/minutes_import.rb), for record keepers:
# the browser sends the files with where each sat in the folder, first to see what they'd
# become (dry_run), then for real.
class Api::GroupMinutesImportsController < ApplicationController
  include GroupScoped

  MAX_FILES = 400
  MAX_BYTES = 15.megabytes

  before_action :set_group
  before_action :require_premium, only: :create
  before_action :require_keeper

  # POST /api/groups/:group_slug/minutes_imports (multipart: files[], names[], dry_run)
  def create
    files = Array(params[:files])
    names = Array(params[:names])
    return render(json: { error: "Choose the minutes to bring in." }, status: :unprocessable_entity) if files.empty?
    return render(json: { error: "That's more than #{MAX_FILES} files; bring them in a few years at a time." }, status: :unprocessable_entity) if files.size > MAX_FILES

    pairs = files.each_with_index.filter_map do |file, i|
      next unless file.respond_to?(:path)
      next [names[i].presence || file.original_filename, "/dev/null/too-big"] if file.size > MAX_BYTES

      [names[i].presence || file.original_filename, file.path]
    end
    dry = ActiveModel::Type::Boolean.new.cast(params[:dry_run])
    rows = MinutesImport.new(@group, pairs, user: current_user).run(dry_run: dry)
    render json: {
      dry_run: dry,
      meetings: rows.count { |r| !r[:skipped] },
      motions: rows.sum { |r| r[:motions]&.size.to_i },
      rows: rows.map { |r| r.merge(held_on: r[:held_on]&.iso8601, motions: r[:motions]&.map { |m| m.slice(:title, :status, :moved_by_name, :seconded_by_name) }) },
    }
  end
end
