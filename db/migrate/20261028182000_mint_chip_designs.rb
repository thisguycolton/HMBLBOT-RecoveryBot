# Minted chips never change. Chips groups already gave keep the design they have now
# (chip_awards.design), and meetings' Meeting Maker designs move from the triangle part to the
# meeting part (ChipDesign.legacy reads either).
class MintChipDesigns < ActiveRecord::Migration[8.0]
  def up
    ChipAward.reset_column_information
    ChipAward.where(design: nil).includes(:group).find_each { |a| a.update_columns(design: ChipDesign.for_group(a.group)) }
    Meeting.where.not(chip_design: nil).find_each do |m|
      next unless m.chip_design.is_a?(Hash) && m.chip_design.key?("triangle")

      m.update_columns(chip_design: ChipDesign.normalize(m.chip_design).slice("meeting").presence)
    end
  end

  def down; end
end
