# Topics in some sets (e.g. "Original Topics") have no category, while the same topic appears
# categorized in another set. This copies the category over by matching titles, so ACID QUEST
# can show a real category instead of "Open Road".
#
#   bin/rails topics:backfill_categories            # preview only (default)
#   bin/rails topics:backfill_categories APPLY=1    # write the changes
#   bin/rails topics:backfill_categories APPLY=1 SET=1   # only one topic set
#
# Every applied run writes tmp/topic_category_backfill_<timestamp>.json listing the topic ids
# it changed, so it can be undone with:
#   bin/rails topics:undo_category_backfill FILE=tmp/topic_category_backfill_....json
namespace :topics do
  normalize = ->(t) { [t.title, t.subtitle].compact.join(" ").downcase.gsub(/[^a-z0-9 ]/, "").squeeze(" ").strip }

  desc "Copy categories onto uncategorized topics whose title matches a categorized topic"
  task backfill_categories: :environment do
    apply = ENV["APPLY"] == "1"

    votes = Hash.new { |h, k| h[k] = Hash.new(0) }
    Topic.where.not(topic_category_id: nil).find_each { |t| votes[normalize.(t)][t.topic_category_id] += 1 }

    scope = Topic.where(topic_category_id: nil)
    scope = scope.where(topic_set_id: ENV["SET"]) if ENV["SET"].present?
    names = TopicCategory.pluck(:id, :title).to_h

    changes = scope.find_each.filter_map do |topic|
      tally = votes[normalize.(topic)]
      next if tally.empty?
      category_id = tally.max_by { |_, n| n }.first # most common wins when sets disagree
      { id: topic.id, title: topic.title, category_id: category_id, ambiguous: tally.size > 1 }
    end

    changes.group_by { |c| c[:category_id] }.sort.each do |cid, list|
      puts "#{names[cid]}: #{list.size} (#{list.first(4).map { |c| c[:title].strip }.join(', ')}#{list.size > 4 ? ', ...' : ''})"
    end
    puts "#{changes.size} topics would get a category (#{changes.count { |c| c[:ambiguous] }} picked the most common of several); #{scope.count - changes.size} stay uncategorized."

    unless apply
      puts "Preview only. Run again with APPLY=1 to write these changes."
      next
    end

    Topic.transaction do
      changes.each { |c| Topic.where(id: c[:id], topic_category_id: nil).update_all(topic_category_id: c[:category_id]) }
    end
    file = Rails.root.join("tmp", "topic_category_backfill_#{Time.current.strftime('%Y%m%d%H%M%S')}.json")
    File.write(file, JSON.pretty_generate(changes))
    puts "Applied. Undo record: #{file.relative_path_from(Rails.root)}"
  end

  desc "Undo a category backfill (FILE=tmp/topic_category_backfill_....json)"
  task undo_category_backfill: :environment do
    changes = JSON.parse(File.read(ENV.fetch("FILE")))
    Topic.where(id: changes.map { |c| c["id"] }).update_all(topic_category_id: nil)
    puts "Cleared the category on #{changes.size} topics."
  end
end
