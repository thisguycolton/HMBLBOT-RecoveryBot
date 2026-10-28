# The six starter chip templates (ChipTemplateStarters), published so groups can use them
class InstallStarterChipTemplates < ActiveRecord::Migration[8.0]
  def up
    ChipTemplate.reset_column_information
    ChipTemplateStarters.install
  end

  def down; end
end
