# Tells a group's record keepers (and the person holding it) that a service term is nearly up, once
# per term, when nobody has been put in after it. There is no job runner here, so a group's
# members opening Group conscience do this for the group (remind_group!), and
# `bin/rails group_service:remind` does it for every group, for a cron job.
module ServiceRotation
  # Terms that ended longer ago than this without a successor are left alone, so a long-finished
  # history doesn't send reminders
  STALE_DAYS = 30

  module_function

  def remind_group!(group, today = group.zone.today)
    due = ServiceTerm.joins(:service_position).includes(service_position: :terms)
                     .where(service_positions: { group_id: group.id, archived: false }, reminded_at: nil)
                     .where("service_terms.ends_on BETWEEN ? AND ?", today - STALE_DAYS, today + ServiceTerm::REMIND_DAYS)
    due.reject(&:succeeded?).each { |term| remind(group, term, today) }
  end

  def remind_all!
    Group.active.find_each { |group| remind_group!(group) }
  end

  def remind(group, term, today)
    position = term.service_position
    verb = term.ends_on < today ? "ended" : "ends"
    url = "/groups/#{group.slug}/conscience/officials"
    keepers = group.record_keepers.where.not(id: term.user_id)
    Notification.deliver(keepers, kind: "service.rotation", title: "#{position.title}: #{term.name}'s term #{verb} #{term.ends_on.strftime("%b %-d")}",
                                  body: "It's time to find someone for #{position.title} at #{group.title}.", url: url)
    Notification.deliver(term.user, kind: "service.term_ending", title: "Your term as #{position.title} #{verb} #{term.ends_on.strftime("%b %-d")}",
                                    body: "Thank you for serving #{group.title}.", url: url) if term.user
    term.update_column(:reminded_at, Time.current)
  end
end
