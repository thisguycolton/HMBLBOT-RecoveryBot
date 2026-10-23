require "test_helper"

class GroupDocumentTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @outsider = User.create!(email: "out@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @group.memberships.create!(user: @outsider, role: "member", status: "requested", can_keep_records: true)
  end

  def doc(attrs = {})
    @group.documents.create!({ title: "Format", kind: "format", body: "Welcome", created_by: @leader }.merge(attrs))
  end

  # A document as the editor makes one: its first save is version 1
  def written(attrs = {}, user = @leader)
    d = @group.documents.new(created_by: user)
    assert d.revise({ title: "Format", kind: "format", body: "Welcome" }.merge(attrs), user)
    d
  end

  test "who keeps records" do
    assert @group.records_editable_by?(@leader)
    assert @group.records_editable_by?(@keeper)
    assert_not @group.records_editable_by?(@member)
    assert_not @group.records_editable_by?(@outsider), "a pending request is not a record keeper"
    assert_not @group.records_editable_by?(nil)
  end

  test "each viewer sees the documents their access allows" do
    public_doc = doc(title: "Public", visibility: "public")
    members_doc = doc(title: "Members", visibility: "members")
    keepers_doc = doc(title: "Keepers", visibility: "keepers")
    draft = doc(title: "Draft", visibility: "public", status: "draft")

    assert_equal [public_doc], GroupDocument.visible_to(@group, nil).to_a
    assert_equal [public_doc], GroupDocument.visible_to(@group, @outsider).to_a
    assert_equal [public_doc, members_doc].sort_by(&:id), GroupDocument.visible_to(@group, @member).sort_by(&:id)
    assert_equal [public_doc, members_doc, keepers_doc, draft].sort_by(&:id), GroupDocument.visible_to(@group, @keeper).sort_by(&:id)
    assert_equal 4, GroupDocument.visible_to(@group, @leader).count
  end

  test "documents start members-only, current, and last in their folder" do
    first = doc
    second = doc(title: "Second")
    assert_equal "members", first.visibility
    assert_equal "current", first.status
    assert_equal [1, 2], [first.position, second.position]
  end

  test "validates kind, visibility and the files it takes" do
    assert_not @group.documents.new(title: "", kind: "format").valid?
    assert_not @group.documents.new(title: "X", kind: "folder").valid?
    assert_not @group.documents.new(title: "X", visibility: "everyone").valid?
    exe = @group.documents.new(title: "X")
    exe.file.attach(io: StringIO.new("MZ"), filename: "run.exe", content_type: "application/octet-stream")
    assert_not exe.valid?
    pdf = @group.documents.new(title: "X")
    pdf.file.attach(io: StringIO.new("%PDF-1.4"), filename: "minutes.pdf", content_type: "application/pdf")
    assert pdf.valid?
  end

  test "each save of new text is a numbered version, with who saved it and their note" do
    d = written
    assert_equal [[1, "created", "Welcome", @leader]], d.versions.map { |v| [v.number, v.kind, v.body, v.user] }
    assert_equal 1, d.head.number

    assert d.revise({ body: "Welcome to all" }, @keeper, message: "  Friendlier   welcome ")
    v = d.head
    assert_equal [2, "saved", "Welcome to all", @keeper, "Friendlier welcome"], [v.number, v.kind, v.body, v.user, v.message]
    assert_equal [2, 0, [@keeper.id]], [v.words_added, v.words_removed, v.contributor_ids]
    assert_equal @keeper, d.updated_by

    assert d.revise({ visibility: "public" }, @keeper)
    assert_equal 2, d.versions.count, "a save that leaves the title, text and file alone makes no version"
  end

  test "a document from before version history starts it with what it had" do
    d = doc
    assert_empty d.versions
    d.revise({ body: "Changed" }, @keeper, message: "First change")
    assert_equal [[2, "Changed", @keeper, "First change"], [1, "Welcome", @leader, nil]], d.versions.map { |v| [v.number, v.body, v.user, v.message] }
    assert_equal "created", d.versions.last.kind
  end

  test "restoring an old version is a new version, so nothing is lost" do
    d = written
    d.revise({ title: "Format v2", body: "Second" }, @keeper)
    d.restore(d.versions.last, @leader)

    d.reload
    assert_equal ["Format", "Welcome"], [d.title, d.body]
    assert_equal [3, 2, 1], d.versions.map(&:number)
    assert_equal ["restored", "Restored version 1", 1], [d.head.kind, d.head.message, d.head.restored_from.number]

    assert d.restore(d.head, @leader)
    assert_equal 3, d.versions.count, "restoring the version it already is changes nothing"
  end

  test "each version keeps its file, and a restore brings it back" do
    d = written
    d.revise({ file: Rack::Test::UploadedFile.new(StringIO.new("%PDF-old"), "application/pdf", original_filename: "old.pdf") }, @keeper)
    d.revise({ file: Rack::Test::UploadedFile.new(file_fixture("avatar.png"), "image/png") }, @keeper)

    assert_equal "avatar.png", d.reload.file.filename.to_s
    assert_equal ["avatar.png", "old.pdf", nil], d.versions.map { |v| v.file.attached? ? v.file.filename.to_s : nil }

    d.restore(d.versions.second, @keeper)
    assert_equal "old.pdf", d.reload.file.filename.to_s
    d.restore(d.versions.find_by(number: 1), @keeper)
    assert_not d.reload.file.attached?
  end

  test "search looks in titles and text" do
    doc(title: "Seventh Tradition", body: "60/30/10")
    doc(title: "Format", body: "Read the preamble")
    assert_equal ["Seventh Tradition"], GroupDocument.search(@group.documents, "tradition").map(&:title)
    assert_equal ["Format"], GroupDocument.search(@group.documents, "PREAMBLE").map(&:title)
    assert_empty GroupDocument.search(@group.documents, "100%")
  end

  test "deleting a group removes its documents, their history and comments" do
    d = written(comment_mode: "members")
    d.revise({ body: "Changed" }, @keeper)
    thread = d.comments.create!(user: @member, body: "Hm", quote: "Changed")
    d.comments.create!(user: @keeper, parent: thread, body: "Yes?")
    assert_difference -> { GroupDocument.count } => -1, -> { GroupDocumentVersion.count } => -2, -> { GroupDocumentComment.count } => -2 do
      @group.destroy!
    end
  end

  test "written documents are cleaned of anything the editor can't make" do
    d = doc(body: %(<h1 onclick="x()">Hi</h1><p style="position:fixed;text-align:center">a <a href="javascript:alert(1)">bad</a> <a href="https://example.com">good</a></p><script>alert(1)</script><img src=x onerror=alert(1)><iframe src="//evil"></iframe><table><tbody><tr><td colspan="2">c</td></tr></tbody></table>))
    html = d.reload.body
    assert_no_match(/script|onclick|onerror|iframe|<img|alert|position|javascript/i, html)
    assert_includes html, "<h1>Hi</h1>"
    assert_includes html, "text-align:center"
    assert_includes html, %(href="https://example.com")
    assert_includes html, %(rel="noopener noreferrer nofollow")
    assert_includes html, %(colspan="2")
  end

  test "an older Markdown document is left exactly as it was written" do
    d = doc(body: "# Hi\n\n<b>not cleaned</b> **bold**", body_format: "markdown")
    assert_equal "# Hi\n\n<b>not cleaned</b> **bold**", d.reload.body
    assert_equal "markdown", d.body_format
    assert_not @group.documents.new(title: "X", body_format: "docx").valid?
  end

  test "each version keeps the format it was written in, and a restore brings it back" do
    d = written(body: "# Old *text*", body_format: "markdown")
    assert d.revise({ body: "<p>New text</p>", body_format: "html" }, @keeper)
    assert_equal "html", d.reload.body_format
    old = d.versions.last
    assert_equal ["# Old *text*", "markdown"], [old.body, old.body_format]
    assert_equal "markdown", old.as_api_json(full: true)[:body_format]

    d.restore(old, @leader)
    assert_equal ["# Old *text*", "markdown"], [d.reload.body, d.body_format]
  end

  test "comments are off until the document turns them on, for its editors or every member" do
    d = written
    [@leader, @keeper, @member, @outsider, nil].each { |u| assert_not d.commentable_by?(u) }
    d.update!(comment_mode: "editors")
    assert_equal [true, true, false, false], [@leader, @keeper, @member, @outsider].map { |u| d.commentable_by?(u) }
    d.update!(comment_mode: "members")
    assert_equal [true, true, true, false], [@leader, @keeper, @member, @outsider].map { |u| d.commentable_by?(u) }
    assert_not @group.documents.new(title: "X", comment_mode: "everyone").valid?
  end

  test "searching and excerpts see the words, not the tags" do
    doc(title: "Format", body: %(<p>Read the <strong>preamble</strong> &amp; the steps</p><ul><li><p>First</p></li><li><p>Second</p></li></ul>))
    assert_equal ["Format"], GroupDocument.search(@group.documents, "the preamble").map(&:title)
    assert_empty GroupDocument.search(@group.documents, "strong")
    assert_empty GroupDocument.search(@group.documents, "<p>")
    assert_equal ["Format"], GroupDocument.search(@group.documents, "preamble & the").map(&:title)
    assert_equal "Read the preamble & the steps First Second", @group.documents.first.as_api_json[:excerpt]
  end
end
