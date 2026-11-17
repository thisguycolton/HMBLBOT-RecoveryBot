# Site admins can give RecoveryBot's own chips (the Site Admin chip design) on Give a chip, from
# no group: those chip awards have no group.
class AllowRecoverybotChipAwards < ActiveRecord::Migration[8.0]
  def change
    change_column_null :chip_awards, :group_id, true
  end
end
