# A HostDeck meeting script every group can start from (Site Admin > HostDeck scripts). A host
# coordinator copies one into the group's documents from Set up HostDeck, and from then on it's
# the group's own document: changing the template later doesn't change groups' copies. The
# built-in one (key "online_meeting") is modeled on The Acid Test's host format and can be put
# back as it came (#reset!); the others are the site admins' own.
class HostScriptTemplate < ApplicationRecord
  moderates_language :name, :description
  BUILT_IN = { "online_meeting" => "host_script_template/online_meeting.html" }.freeze

  belongs_to :updated_by, class_name: "User", optional: true

  before_validation { self.name = name.to_s.squish }
  before_validation { self.description = description.to_s.squish.presence }
  before_validation { self.body = DocumentHtml.sanitize(body) if body.present? }
  before_validation(on: :create) { self.position = (self.class.maximum(:position) || 0) + 1 if position.zero? }

  validates :name, presence: true, length: { maximum: 120 }
  validates :description, length: { maximum: 300 }
  validates :body, length: { maximum: GroupDocument::BODY_MAX }
  validates :key, uniqueness: true, allow_nil: true

  scope :ordered, -> { order(:position, :id) }
  scope :offered, -> { where(hidden: false).ordered }

  def built_in? = BUILT_IN.key?(key)

  # The built-in script as it came
  def self.built_in_body(key) = File.read(Rails.root.join("app/models", BUILT_IN.fetch(key)))

  def reset!(user)
    update!(body: self.class.built_in_body(key), updated_by: user)
  end

  # The script's section titles, in order, as HostDeck steps through them (Insert > Add Section)
  def section_titles
    body.to_s.scan(/<div[^>]*data-hc-section[^>]*>/).map { |tag| CGI.unescapeHTML(tag[/data-title="([^"]*)"/, 1].to_s) }
  end

  # A copy in the group's documents (Format folder, for the hosts), made by this person
  def copy_to(group, user, title: nil)
    group.documents.new(created_by: user).tap do |doc|
      doc.revise({ title: title.presence || name, kind: "format", visibility: "hosts", status: "current", body: body, body_format: "html" },
                 user, message: "Started from the HostDeck template “#{name}”")
    end
  end

  def as_offer_json = { id: id, name: name, description: description, sections: section_titles }

  def as_admin_json
    as_offer_json.merge(key: key, built_in: built_in?, hidden: hidden, position: position, updated_at: updated_at,
                        updated_by: updated_by&.display_name)
  end

  def as_editor_json = as_admin_json.merge(body: body.to_s)
end
