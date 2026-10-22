# A group's decisions log as a RecoveryBot JSON file, and back: a record keeper downloads every
# motion, fixes them wherever is easiest (by hand, or with help), and brings the file back in.
# Importing always shows what it would change first (dry_run), and then does all of it or none.
#
# Each decision keeps its id, so importing changes it in place. One without an id is new; give it a
# "ref" (any word) and others in the file can point at it before it has an id. "parent_id" (the
# motion it applies to) and "supersedes_id" (the decision it replaces) take an id or a ref.
# "delete": true takes a decision out (group admins only). A decision left out of the file, or a
# field left out of a decision, is left as it is. "meeting" is the date of the group's business
# meeting it was made at (null for none).
class DecisionsJson
  FORMAT = "recoverybot-decisions"
  VERSION = 1
  # The fields a file may set, as they're named in it, and the motion attribute each one is
  FIELDS = {
    "title" => :title, "text" => :text, "kind" => :kind, "status" => :status, "category" => :category,
    "visibility" => :visibility, "moved_by" => :moved_by_name, "seconded_by" => :seconded_by_name,
    "votes_for" => :votes_for, "votes_against" => :votes_against, "abstentions" => :abstentions,
    "vote_method" => :vote_method, "required_vote" => :required_vote, "previous_notice" => :previous_notice,
    "decided_on" => :decided_on, "minority_opinion" => :minority_opinion, "committee" => :committee,
    "postponed_to" => :postponed_to, "amended_text" => :amended_text, "note" => :note,
    "one_time" => :one_time, "ignore_rules" => :ignore_rules, "needs_review" => :needs_review,
  }.freeze
  LINKS = { "parent_id" => :parent_id, "supersedes_id" => :supersedes_id }.freeze
  MAX_DECISIONS = 2000

  class Invalid < StandardError; end

  def self.export(group)
    meetings = group.business_meetings.pluck(:id, :held_on).to_h
    {
      format: FORMAT, version: VERSION, exported_at: Time.current.iso8601,
      group: { slug: group.slug, title: group.title },
      how_to: "Change any decision and import this file again on the Decisions page; you'll see every change before it's saved. " \
              "Keep each id. A new decision has no id: give it a \"ref\" so others can point at it. parent_id is the motion it applies to, " \
              "supersedes_id the decision it replaces (an id or a ref). \"delete\": true takes one out. meeting is its business meeting's date.",
      kinds: MotionKinds::KEYS, statuses: Motion::STATUSES, categories: Motion::CATEGORIES,
      decisions: group.motions.order(Arel.sql("decided_on NULLS FIRST"), :id).map do |m|
        { id: m.id, meeting: meetings[m.business_meeting_id]&.iso8601 }
          .merge(FIELDS.to_h { |key, attr| [key.to_sym, m.public_send(attr).then { |v| v.is_a?(Date) ? v.iso8601 : v }] })
          .merge(parent_id: m.parent_id, supersedes_id: m.supersedes_id, imported: m.imported)
      end,
    }
  end

  def initialize(group, text, can_delete: false, user: nil)
    @group = group
    @text = text
    @can_delete = can_delete
    @user = user
  end

  # -> { ok:, summary: {create:, update:, delete:, unchanged:}, rows: [...] }. Nothing is kept
  # when dry_run, or when any row has a problem.
  def run(dry_run: true)
    items = parse
    rows = nil
    ok = false
    Motion.transaction do
      rows = apply(items)
      ok = rows.none? { |r| r[:errors].any? }
      raise ActiveRecord::Rollback if dry_run || !ok
    end
    summary = %w[create update delete unchanged].to_h { |a| [a.to_sym, rows.count { |r| r[:action] == a }] }
    { ok: ok, saved: ok && !dry_run, summary: summary, rows: rows.reject { |r| r[:action] == "unchanged" && r[:errors].empty? } }
  end

  private

  def parse
    data = JSON.parse(@text.to_s)
    raise Invalid, "That file isn't a RecoveryBot decisions file. Use one made with Download JSON on the Decisions page." unless data.is_a?(Hash) && data["format"] == FORMAT && data["decisions"].is_a?(Array)
    raise Invalid, "That file was made by a newer RecoveryBot. Reload the page and try again." if data["version"].to_i > VERSION
    raise Invalid, "That's more than #{MAX_DECISIONS} decisions." if data["decisions"].size > MAX_DECISIONS
    raise Invalid, "Every decision in the file must be an object." unless data["decisions"].all?(Hash)

    data["decisions"]
  rescue JSON::ParserError
    raise Invalid, "That file isn't readable JSON."
  end

  def apply(items)
    existing = @group.motions.index_by(&:id)
    meetings = @group.business_meetings.index_by(&:held_on)
    refs = {}
    rows = items.each_with_index.map do |item, i|
      id = item["id"].presence
      row = { index: i, id: id, ref: item["ref"].presence, title: (item["title"].presence || existing[id.to_i]&.title).to_s, changes: {}, errors: [] }
      motion = id && existing[id.to_i]
      if id && !motion
        row[:errors] << "There's no decision #{id} in this group."
        row[:action] = "update"
      elsif ActiveModel::Type::Boolean.new.cast(item["delete"])
        row[:action] = "delete"
        row[:errors] << "Only this group's admins can delete decisions." unless @can_delete
        row[:errors] << "A new decision can't be deleted." unless motion
      else
        motion ||= @group.motions.new(created_by: @user, imported: true)
        row[:action] = motion.new_record? ? "create" : "update"
        if row[:ref]
          row[:errors] << "Two decisions use the ref “#{row[:ref]}”." if refs.key?(row[:ref])
          refs[row[:ref]] = motion
        end
        assign(motion, item, meetings, row)
      end
      row[:motion] = motion
      row
    end

    deleting = rows.select { |r| r[:action] == "delete" }.filter_map { |r| r[:motion]&.id }.to_set
    live = ->(row) { row[:motion] && row[:action] != "delete" && row[:errors].empty? }

    # The fields first, so every new decision has an id before anything points at it
    rows.each { |row| save(row) if live.call(row) && (row[:action] == "create" || row[:changes].any?) }

    rows.each do |row|
      next unless live.call(row)

      item = items[row[:index]]
      linked = false
      LINKS.each do |key, attr|
        next unless item.key?(key)

        target = link_target(item[key], existing, refs, row)
        next if target == :missing
        next row[:errors] << "It points at a new decision that couldn't be saved." if target&.new_record?
        next row[:errors] << "It points at a decision this file deletes." if target && deleting.include?(target.id)

        before = row[:motion].public_send(attr)
        next if before == target&.id

        row[:motion].public_send("#{attr}=", target&.id)
        row[:changes][key] = [label(before && Motion.find_by(id: before)), label(target, new: refs.value?(target) && !existing.key?(target.id))]
        linked = true
      end
      save(row) if linked && row[:errors].empty?
      row[:action] = "unchanged" if row[:action] == "update" && row[:changes].empty?
    end

    rows.each { |row| row[:motion].destroy! if row[:action] == "delete" && row[:errors].empty? }
    rows.each { |r| r.delete(:motion) }
  end

  def assign(motion, item, meetings, row)
    FIELDS.each do |key, attr|
      next unless item.key?(key)

      before = motion.public_send(attr)
      motion.public_send("#{attr}=", item[key])
      after = motion.public_send(attr)
      row[:changes][key] = [show(before), show(after)] if motion.new_record? ? after.present? : before != after
    end
    assign_meeting(motion, item["meeting"], meetings, row) if item.key?("meeting")

    # A decided one needs its date: its meeting's, unless the file gives one
    return unless motion.decided_on.nil? && Motion::DECIDED.include?(motion.status) && motion.business_meeting

    motion.decided_on = motion.business_meeting.held_on
    row[:changes]["decided_on"] = [nil, show(motion.decided_on)]
  end

  def assign_meeting(motion, value, meetings, row)
    date = value.presence && (Date.iso8601(value.to_s) rescue nil)
    return row[:errors] << "“#{value}” isn't a date (use 2024-06-16)." if value.present? && !date
    return row[:errors] << "There's no business meeting on #{date.strftime("%b %-d, %Y")}." if date && !meetings[date]

    before = motion.business_meeting&.held_on
    motion.business_meeting = date && meetings[date]
    row[:changes]["meeting"] = [show(before), show(date)] if before != date
  end

  # -> a motion (existing or about to be made), nil to clear it, or :missing after noting why
  def link_target(value, existing, refs, row)
    return nil if value.blank?
    return refs[value.to_s] if refs.key?(value.to_s)
    return existing[value.to_i] if value.to_s.match?(/\A\d+\z/) && existing[value.to_i]

    row[:errors] << "“#{value}” isn't a decision in this group or a ref in the file."
    :missing
  end

  def save(row)
    row[:errors].concat(row[:motion].errors.full_messages) unless row[:motion].save
  end

  # How a linked decision reads in the preview
  def label(motion, new: false) = motion && "#{motion.title.truncate(80)}#{new ? " (new)" : " (##{motion.id})"}"

  def show(value) = value.is_a?(Date) ? value.iso8601 : value
end
