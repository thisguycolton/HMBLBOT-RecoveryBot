# Group settings for decision links (Motion#share!): who may share one, and what its page shows
class AddDecisionShareSettingsToGroups < ActiveRecord::Migration[8.0]
  def change
    add_column :groups, :decision_sharers, :string, default: "officers", null: false
    add_column :groups, :decision_share_fields, :string, array: true, null: false,
                                                         default: %w[text amended_text counts minority_opinion group]
  end
end
