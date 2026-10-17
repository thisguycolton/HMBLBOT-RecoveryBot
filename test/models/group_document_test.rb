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

  test "every save keeps the copy it replaced, with its author" do
    d = doc
    assert_empty d.versions

    assert d.revise({ body: "Welcome to all" }, @keeper)
    assert_equal 1, d.versions.count
    old = d.versions.first
    assert_equal "Welcome", old.body
    assert_equal @leader, old.user
    assert_equal @keeper, d.updated_by

    assert d.revise({ visibility: "public" }, @keeper)
    assert_equal 1, d.versions.count, "a save that leaves the title and text alone makes no version"
  end

  test "restoring an old copy is a new save" do
    d = doc
    d.revise({ title: "Format v2", body: "Second" }, @keeper)
    d.restore(d.versions.first, @leader)

    d.reload
    assert_equal ["Format", "Welcome"], [d.title, d.body]
    assert_equal 2, d.versions.count
    assert_equal "Second", d.versions.first.body
  end

  test "a replaced file stays with the copy that had it" do
    d = doc
    d.file.attach(io: StringIO.new("%PDF-old"), filename: "old.pdf", content_type: "application/pdf")
    d.revise({ file: Rack::Test::UploadedFile.new(file_fixture("avatar.png"), "image/png") }, @keeper)

    assert_equal "avatar.png", d.reload.file.filename.to_s
    assert_equal "old.pdf", d.versions.first.file.filename.to_s

    d.restore(d.versions.first, @keeper)
    assert_equal "old.pdf", d.reload.file.filename.to_s
  end

  test "search looks in titles and text" do
    doc(title: "Seventh Tradition", body: "60/30/10")
    doc(title: "Format", body: "Read the preamble")
    assert_equal ["Seventh Tradition"], GroupDocument.search(@group.documents, "tradition").map(&:title)
    assert_equal ["Format"], GroupDocument.search(@group.documents, "PREAMBLE").map(&:title)
    assert_empty GroupDocument.search(@group.documents, "100%")
  end

  test "deleting a group removes its documents and their history" do
    d = doc
    d.revise({ body: "Changed" }, @keeper)
    assert_difference -> { GroupDocument.count } => -1, -> { GroupDocumentVersion.count } => -1 do
      @group.destroy!
    end
  end
end
