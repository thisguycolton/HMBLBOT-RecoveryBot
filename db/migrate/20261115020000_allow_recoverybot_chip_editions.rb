# RecoveryBot's own Special Editions (Site Admin > Sobriety chips): made by site admins, for every
# member rather than one group, so they have no group.
class AllowRecoverybotChipEditions < ActiveRecord::Migration[8.0]
  def change
    change_column_null :chip_editions, :group_id, true
  end
end
