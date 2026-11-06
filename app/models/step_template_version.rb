# A published version of a StepTemplate, kept for its History (and to go back to). Never
# changes once made.
class StepTemplateVersion < ApplicationRecord
  belongs_to :step_template
  belongs_to :published_by, class_name: "User", optional: true

  before_update { throw :abort }
end
