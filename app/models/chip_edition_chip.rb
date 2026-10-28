# One Special Edition chip someone has (ChipEdition): claimed, earned, or given by a host
# (then it rides along on the ChipAward, and is theirs when the award is), with its number
class ChipEditionChip < ApplicationRecord
  belongs_to :chip_edition
  belongs_to :user, optional: true
  belongs_to :chip_award, optional: true

  scope :claimed, -> { where.not(claimed_at: nil) }

  def label = chip_edition.kind == "milestone" ? ChipAward.label_for(milestone_key, years) : "#{count} meetings"

  def as_chip_json
    e = chip_edition
    chip = { id: "edition:#{id}", slot: slot, label: label, on: earned_on.iso8601, source: "edition", design: e.chip_design,
             group: { title: e.group.title, logo_url: e.logo_url }, edition: e.edition_json(serial) }
    if e.kind == "milestone"
      chip.merge(shape: "round", kind: "round", milestone: { key: milestone_key, years: years, label: label }.compact)
    else
      chip.merge(shape: e.chip_design.dig("meeting", "shape") || "triangle", kind: "meeting", count: count, series: "edition-#{e.id}",
                 meeting: { name: e.name, group_title: e.group.title })
    end
  end
end
