# An admin's comment on a TextReport.
class TextReportComment < ApplicationRecord
  belongs_to :text_report, touch: true
  belongs_to :user

  validates :body, presence: true, length: { maximum: 5_000 }
end
