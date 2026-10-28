# A published, frozen version of a ChipTemplate: what a chip design points at (ChipDesign
# scene: template_id and version), so it never changes once anyone has a chip in it.
class ChipTemplateVersion < ApplicationRecord
  belongs_to :chip_template

  before_update { throw :abort }
end
