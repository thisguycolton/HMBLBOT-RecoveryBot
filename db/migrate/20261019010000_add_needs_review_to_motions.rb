# Motions brought in from old minutes (lib/tasks/minutes.rake) wait for a record keeper to
# check them before members see them
class AddNeedsReviewToMotions < ActiveRecord::Migration[8.0]
  def change
    add_column :motions, :needs_review, :boolean, null: false, default: false
  end
end
