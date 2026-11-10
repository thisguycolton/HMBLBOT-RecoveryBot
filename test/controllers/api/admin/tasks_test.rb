require "test_helper"

# Site Admin > Task board (SCRUMBLBOT): AdminTask, its columns and who hears about what.
class Api::Admin::TasksTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @colton = User.create!(email: "colton@example.com", password: "password123", confirmed: true, name: "Colton H", username: "colton", admin: true)
    @jo = User.create!(email: "jo@example.com", password: "password123", confirmed: true, name: "Jo M", username: "jo", admin: true)
    @member = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee")
    if AdminTaskColumn.none?
      AdminTaskColumn.create!(name: "Up for grabs", kind: "start", position: 1)
      AdminTaskColumn.create!(name: "Doing", kind: "doing", position: 2)
      AdminTaskColumn.create!(name: "Done", kind: "finished", position: 3)
    end
    @start, @doing, @done = AdminTaskColumn.ordered.to_a
    @old_admins = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "colton@example.com,jo@example.com"
  end

  teardown { ENV["ADMIN_EMAILS"] = @old_admins }

  test "only site admins see the board" do
    sign_in @member
    get "/api/admin/tasks", as: :json
    assert_response :forbidden
    post "/api/admin/tasks", params: { title: "Sneaky" }, as: :json
    assert_response :forbidden
  end

  test "making a task, taking it, finishing it and reopening it" do
    sign_in @colton
    post "/api/admin/tasks", params: { title: "  Review   pending groups ", priority: "high", due_on: Date.current + 1, link_path: "/groups" }, as: :json
    assert_response :created
    task = AdminTask.find(response.parsed_body["id"])
    assert_equal "Review pending groups", task.title
    assert_equal @start, task.column
    assert task.urgent?

    sign_in @jo
    post "/api/admin/tasks/#{task.id}/take", as: :json
    assert_response :success
    task.reload
    assert_equal @jo, task.assignee
    assert_equal @doing, task.column

    post "/api/admin/tasks/#{task.id}/complete", as: :json
    task.reload
    assert task.done?
    assert_equal @done, task.column
    assert_equal @jo, task.completed_by
    assert Notification.exists?(user: @colton, kind: "admin_task.done")

    post "/api/admin/tasks/#{task.id}/reopen", as: :json
    task.reload
    refute task.done?
    assert_equal @doing, task.column
    assert_equal %w[created took done reopened], task.activities.map(&:kind).reject { |k| k == "moved" }
  end

  test "moving a card into Done finishes it, and out again reopens it, keeping positions tidy" do
    sign_in @colton
    a, b, c = %w[A B C].map { |t| AdminTask.create!(title: t, column: @start, creator: @colton) }
    [a, b, c].each_with_index { |t, i| t.update_columns(position: i + 1) }

    post "/api/admin/tasks/#{c.id}/move", params: { column_id: @start.id, index: 0 }, as: :json
    assert_response :success
    assert_equal %w[C A B], @start.tasks.reload.map(&:title)
    assert_equal [1, 2, 3], @start.tasks.map(&:position)

    post "/api/admin/tasks/#{a.id}/move", params: { column_id: @done.id, index: 0 }, as: :json
    assert a.reload.done?
    assert_equal %w[C B], @start.tasks.reload.map(&:title)
    assert_equal [1, 2], @start.tasks.map(&:position)

    post "/api/admin/tasks/#{a.id}/move", params: { column_id: @doing.id, index: 0 }, as: :json
    refute a.reload.done?
  end

  test "giving a task tells the admin, and all-admin tasks tell everyone else" do
    sign_in @colton
    task = AdminTask.create!(title: "Write January notice", column: @start, creator: @colton)
    post "/api/admin/tasks/#{task.id}/give", params: { assignee_id: @jo.id }, as: :json
    assert_response :success
    assert_equal @jo, task.reload.assignee
    assert Notification.exists?(user: @jo, kind: "admin_task.assigned", title: "Colton H gave you a task")

    post "/api/admin/tasks/#{task.id}/give", params: { assignee_id: @member.id }, as: :json
    assert_response :unprocessable_entity

    post "/api/admin/tasks", params: { title: "Everyone look", for_all_admins: true }, as: :json
    assert Notification.exists?(user: @jo, kind: "admin_task.assigned", title: "New task for all site admins")
    refute Notification.exists?(user: @colton, kind: "admin_task.assigned")
  end

  test "comments tell the people on the task and @ mentioned admins, not the writer" do
    task = AdminTask.create!(title: "Proofread help page", column: @start, creator: @colton)
    third = User.create!(email: "sam@example.com", password: "password123", confirmed: true, name: "Sam", username: "sam", admin: true)
    ENV["ADMIN_EMAILS"] += ",sam@example.com"
    sign_in @jo
    post "/api/admin/tasks/#{task.id}/comment", params: { body: "Looks good @sam" }, as: :json
    assert_response :created
    assert Notification.exists?(user: @colton, kind: "admin_task.comment")
    assert Notification.exists?(user: third, kind: "admin_task.comment")
    refute Notification.exists?(user: @jo, kind: "admin_task.comment")
    assert_equal 1, response.parsed_body["comments"]
  end

  test "tags are the standard kanban ones, and can be changed and cleared" do
    sign_in @colton
    post "/api/admin/tasks", params: { title: "Broken link", tags: %w[Bug blocked made-up bug] }, as: :json
    assert_response :created
    assert_equal %w[bug blocked], response.parsed_body["tags"]
    id = response.parsed_body["id"]
    patch "/api/admin/tasks/#{id}", params: { tags: %w[feature] }, as: :json
    assert_equal %w[feature], response.parsed_body["tags"]
    assert_equal %w[tags], AdminTask.find(id).activities.find_by(kind: "edited").data["fields"]
    patch "/api/admin/tasks/#{id}", params: { tags: [] }, as: :json
    assert_equal [], response.parsed_body["tags"]
    patch "/api/admin/tasks/#{id}", params: { title: "Still no tags" }, as: :json
    assert_equal [], AdminTask.find(id).tags
  end

  test "links stay on this site, and only the maker deletes" do
    sign_in @colton
    post "/api/admin/tasks", params: { title: "Bad link", link_path: "https://evil.example" }, as: :json
    assert_response :unprocessable_entity
    post "/api/admin/tasks", params: { title: "Sneaky", link_path: "//evil.example" }, as: :json
    assert_response :unprocessable_entity

    task = AdminTask.create!(title: "Mine", column: @start, creator: @colton)
    sign_in @jo
    delete "/api/admin/tasks/#{task.id}", as: :json
    assert_response :forbidden
    patch "/api/admin/tasks/#{task.id}", params: { archived: true }, as: :json
    assert_response :success
    assert task.reload.archived_at
    sign_in @colton
    delete "/api/admin/tasks/#{task.id}", as: :json
    assert_response :no_content
  end

  test "the Dashboard shows what's urgent for you, and Today shows yours" do
    today = AdminTask.today
    high = AdminTask.create!(title: "High one", column: @start, priority: "high")
    soon = AdminTask.create!(title: "Due soon", column: @start, due_on: today + 2)
    AdminTask.create!(title: "Later", column: @start, due_on: today + 20)
    jos = AdminTask.create!(title: "Jo's, not late", column: @doing, assignee: @jo, priority: "high")
    late = AdminTask.create!(title: "Jo's, late", column: @doing, assignee: @jo, due_on: today - 1)
    mine = AdminTask.create!(title: "Mine", column: @doing, assignee: @colton)
    all = AdminTask.create!(title: "For all", column: @start, for_all_admins: true)

    assert_equal [late, high, soon].map(&:id), AdminTask.by_urgency(AdminTask.urgent_for(@colton).to_a).map(&:id)
    refute_includes AdminTask.urgent_for(@colton), jos

    sign_in @colton
    get "/api/admin/overview", as: :json
    assert_equal 3, response.parsed_body["tasks"]["urgent_count"]
    assert_equal "Jo's, late", response.parsed_body["tasks"]["urgent"].first["title"]
    assert_equal "overdue", response.parsed_body["tasks"]["urgent"].first["due_state"]

    titles = PeopleHome.new(@colton).json[:admin_tasks][:tasks].map { |t| t[:title] }
    assert_equal ["Mine", "For all"].sort, titles.sort
    assert_nil PeopleHome.new(@member).json[:admin_tasks]
    assert mine && all
  end

  test "due reminders go out once, after 8 in the morning" do
    today = AdminTask.today
    task = AdminTask.create!(title: "Due tomorrow", column: @doing, assignee: @jo, due_on: today + 1)
    late = AdminTask.create!(title: "Late", column: @start, due_on: today - 1)
    morning = Time.find_zone(AdminTask::ZONE).local(today.year, today.month, today.day, 9)
    assert_equal 2, AdminTaskReminders.send_due!(morning)
    assert_equal 0, AdminTaskReminders.send_due!(morning + 1.hour)
    assert Notification.exists?(user: @jo, kind: "admin_task.due", title: "Task due tomorrow")
    assert Notification.exists?(user: @colton, kind: "admin_task.due", title: "Overdue task", body: "Late")
    assert task && late
    assert_equal 0, AdminTaskReminders.send_due!(morning.change(hour: 6) + 1.day)
  end

  test "columns: add before Done, can't remove Done or a column with tasks" do
    sign_in @colton
    post "/api/admin/task_columns", params: { name: "Waiting on someone" }, as: :json
    assert_response :created
    assert_equal ["Up for grabs", "Doing", "Waiting on someone", "Done"], response.parsed_body["columns"].map { |c| c["name"] }

    delete "/api/admin/task_columns/#{@done.id}", as: :json
    assert_response :unprocessable_entity
    AdminTask.create!(title: "Here", column: @doing)
    delete "/api/admin/task_columns/#{@doing.id}", as: :json
    assert_response :unprocessable_entity
    patch "/api/admin/task_columns/#{@done.id}", params: { kind: "doing" }, as: :json
    assert_response :unprocessable_entity
    waiting = AdminTaskColumn.find_by(name: "Waiting on someone")
    patch "/api/admin/task_columns/#{waiting.id}", params: { name: "Waiting", index: 0 }, as: :json
    assert_equal "Waiting", response.parsed_body["columns"].first["name"]
    delete "/api/admin/task_columns/#{waiting.id}", as: :json
    assert_response :success
  end
end
