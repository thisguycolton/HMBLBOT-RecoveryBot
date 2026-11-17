# Who hears about what on Site Admin > Task board (SCRUMBLBOT), in the bell and (if they kept
# "Site admin tasks" on) as a push. Nobody is told about what they did themselves, and a plain
# move between columns tells nobody, so it stays quiet.
module AdminTaskNotices
  module_function

  def url(task) = "/admin_panel/tasks?task=#{task.id}"

  # Given to them, or a new task for all site admins
  def assigned(task, by)
    if task.assignee
      return if task.assignee == by

      Notification.deliver(task.assignee, kind: "admin_task.assigned", title: "#{by.display_name} gave you a task",
                                          body: summary(task), url: url(task))
    elsif task.for_all_admins
      Notification.deliver(admins - [by], kind: "admin_task.assigned", title: "New task for all site admins",
                                          body: summary(task), url: url(task))
    end
  end

  # Finished: the one who made it hears, unless they finished it themselves
  def done(task, by)
    return unless task.creator && task.creator != by

    Notification.deliver(task.creator, kind: "admin_task.done", title: "#{by.display_name} finished your task",
                                       body: task.title, url: url(task))
  end

  # A comment: whoever made it, has it, commented before, or was @ mentioned (by username)
  def comment(task, activity)
    by = activity.user
    people = [task.creator, task.assignee]
    people += User.where(id: task.activities.where(kind: "comment").select(:user_id)).to_a
    handles = Mentions.handles(activity.body)
    people += User.where("LOWER(username) IN (?)", handles).to_a if handles.any?
    people = people.compact.uniq.select(&:suite_admin?) - [by]
    Notification.deliver(people, kind: "admin_task.comment", title: "#{by&.display_name || 'Someone'} commented on a task",
                                 body: "#{task.title}: #{activity.body}", url: url(task))
  end

  # The morning before it's due, and the morning after it went overdue (AdminTaskReminders)
  def due(task, overdue:)
    people = task.assignee ? [task.assignee] : admins
    title = overdue ? "Overdue task" : "Task due tomorrow"
    Notification.deliver(people, kind: "admin_task.due", title: title, body: task.title, url: url(task))
  end

  def admins = User.suite_admins

  def summary(task)
    [task.title, task.high? && "High priority", task.due_on && "due #{task.due_on.strftime('%b %-d')}"].select(&:itself).join(" · ")
  end
end
