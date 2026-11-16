# A chip a site admin took back from a member because they got it by mistake (Site Admin >
# Members > Chips), and what went on top of that milestone's stack instead. It's the record of
# who did it and when, with how both chips looked.
#
# Only chips someone was given or claimed can go back: a ChipAward ("award:ID") or a Special
# Edition chip ("edition:ID"). Earned chips come from the member's own sobriety date or
# writing, so they can't. The chip's row stays, marked revoked_at: its edition number stays used,
# and a Special Edition can't be claimed or earned again by the same person.
#
# The replacement is another chip in the same stack (same slot), or, for a round milestone,
# RecoveryBot's own chip given now ("site") when nothing else is left there. It goes on top, and
# takes the revoked chip's place in their profile favorites.
#
# Their posts that shared the revoked chip (TimelineNote#chip_id) stay up with their words as
# they wrote them. With a replacement the post's chip becomes the replacement; with none, the chip
# post is hidden from everyone else (chip_hidden), as when a sobriety date change takes one away.
class ChipRevocation < ApplicationRecord
  SITE = "site"
  class Invalid < StandardError; end

  belongs_to :user
  belongs_to :revoked_by, class_name: "User", optional: true

  validates :chip_id, :slot, presence: true
  validates :note, length: { maximum: 500 }

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }

  # A member's chips that could go back, by id ("award:12", "edition:4")
  def self.record_for(user, chip_id)
    kind, id = chip_id.to_s.split(":", 2)
    case kind
    when "award" then user.chip_awards.claimed.find_by(id: id)
    when "edition" then ChipEditionChip.claimed.find_by(id: id, user: user, chip_award_id: nil)
    end
  end

  def self.revocable?(chip) = %w[given edition].include?(chip[:source].to_s)

  # The chips in a member's stack for `slot`, as Chips.catalog draws them, top first
  def self.stack(user, slot, today = Date.current)
    Chips.ordered(Chips.catalog(user, today)[:chips], user.chip_tops).select { |c| c[:slot] == slot }
  end

  # Take `chip_id` back from `user`, put `replacement_id` on top of that stack (another chip
  # in it, SITE, or nil), and tell them. Raises Invalid with a message for the admin.
  def self.revoke!(user:, chip_id:, by:, replacement_id: nil, note: "", today: Date.current)
    chip_id = chip_id.to_s
    replacement_id = replacement_id.presence&.to_s
    note = note.to_s.strip
    raise Invalid, "Keep the note under 500 characters." if note.length > 500

    transaction do
      record = record_for(user, chip_id) or raise Invalid, "That isn't a chip they were given or claimed, so it can't be taken back."
      before = stack(user, record.slot, today)
      chip = before.find { |c| c[:id] == chip_id } or raise Invalid, "That chip isn't on their Chips page."

      now = Time.current
      record.update_columns(revoked_at: now, updated_at: now)
      record.edition_chip&.update_columns(revoked_at: now, updated_at: now) if record.is_a?(ChipAward)

      replacement = pick_replacement(user, chip, replacement_id, by, today)
      move_choices(user, chip, replacement)
      swapped, hidden = fix_posts(user, chip, replacement, today)

      revocation = create!(user: user, revoked_by: by, chip_id: chip_id, slot: chip[:slot], label: chip[:label].to_s,
                           chip: snapshot(chip), replacement_id: replacement&.dig(:id), replacement: replacement && snapshot(replacement),
                           note: note, posts_swapped: swapped, posts_hidden: hidden)
      revocation.tell_member
      revocation
    end
  end

  # The chip that goes on top instead: one left in the stack, or RecoveryBot's own given now
  def self.pick_replacement(user, chip, replacement_id, by, today)
    return nil unless replacement_id

    if replacement_id == SITE
      raise Invalid, "RecoveryBot's own chip is only for sobriety milestones." unless chip[:shape] == "round" && chip[:milestone]

      award = ChipAward.create!(group: nil, given_by: by, user: user, email: user.email, milestone_key: chip.dig(:milestone, :key),
                                years: chip.dig(:milestone, :years), on: [Date.parse(chip[:on].to_s), Date.current].min,
                                claimed_at: Time.current, celebrated_at: Time.current) # the swap's own notification says so
      return award.as_chip_json
    end

    raise Invalid, "Pick a chip other than the one going back." if replacement_id == chip[:id]

    stack(user, chip[:slot], today).find { |c| c[:id] == replacement_id } or
      raise Invalid, "That chip isn't in the same milestone's stack."
  end

  # The replacement goes on top of the stack and into the revoked chip's favorites spot
  def self.move_choices(user, chip, replacement)
    tops = user.chip_tops.dup
    replacement ? tops[chip[:slot]] = replacement[:id] : tops.delete(chip[:slot])
    favorites = user.chip_favorites.map { |id| id == chip[:id] ? replacement&.dig(:id) : id }.compact.uniq
    user.update_columns(chip_tops: tops, chip_favorites: favorites)
  end

  # Their posts of the revoked chip: now showing the replacement, or hidden from others.
  # The words they wrote aren't touched. Returns [swapped, hidden].
  def self.fix_posts(user, chip, replacement, today)
    notes = user.timeline_notes.where(chip_id: chip[:id])
    count = notes.count
    return [0, 0] if count.zero?

    if replacement && (shown = TimelineNote.chip_for(user, replacement[:id], today))
      notes.update_all(chip_id: replacement[:id], chip: shown, chip_hidden: false)
      [count, 0]
    else
      notes.update_all(chip_hidden: true)
      [0, count]
    end
  end

  def self.snapshot(chip) = chip.except(:top, :others, :note).merge(design: chip[:design] || ChipDesign::DEFAULT).deep_stringify_keys

  # A bell notification (and push, under Chips) saying what changed
  def tell_member
    from = chip.dig("group", "title")
    title = "A site admin took back the #{label} chip#{" from #{from}" if from}"
    lines = []
    lines << note if note.present?
    if replacement
      lines << (replacement["source"] == "earned" ? "Your own #{label} chip is on top now." : "Your #{label} chip from #{replacement.dig('group', 'title') || ChipAward::SITE_TITLE} is on top now.")
    else
      lines << "It was given by mistake."
    end
    lines << "Posts where you shared it show the new chip." if posts_swapped.positive?
    lines << "Posts where you shared it are hidden from others now." if posts_hidden.positive?
    Notification.deliver(user, kind: "chip.revoked", title: title, body: lines.join(" "),
                               url: replacement_id ? "/recovery?chip=#{replacement_id}" : "/recovery")
  end

  # For Site Admin > Members > Chips
  def as_api_json
    { id: id, chip_id: chip_id, slot: slot, label: label, chip: chip, replacement: replacement, note: note.presence,
      posts_swapped: posts_swapped, posts_hidden: posts_hidden, revoked_by: revoked_by&.display_name || revoked_by&.email,
      created_at: created_at.iso8601 }
  end
end
