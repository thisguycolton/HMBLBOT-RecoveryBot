# The letterhead for one folder of a group's documents (Document templates in the group
# dashboard): a mark at the top (none, the group's logo, or a seal uploaded for it), a heading
# and a line under it, and a footer. Documents in that folder show it on the page and in print.
class GroupDocumentTemplate < ApplicationRecord
  MARKS = %w[none group_logo seal].freeze
  ALIGNS = %w[left center].freeze
  IMAGE_TYPES = %w[image/png image/jpeg image/webp image/gif].freeze

  belongs_to :group
  has_one_attached :seal

  before_validation { %i[header_text subheader_text footer_text].each { |a| self[a] = self[a].to_s.squish.presence } }

  validates :kind, inclusion: { in: GroupDocument::KINDS }, uniqueness: { scope: :group_id }
  validates :mark, inclusion: { in: MARKS }
  validates :align, inclusion: { in: ALIGNS }
  validates :header_text, :subheader_text, length: { maximum: 160 }
  validates :footer_text, length: { maximum: 300 }
  validate { errors.add(:seal, "has to be a PNG, JPEG, WebP or GIF image") if seal.attached? && !IMAGE_TYPES.include?(seal.blob.content_type) }
  validate { errors.add(:seal, "has to be under 5 MB") if seal.attached? && seal.blob.byte_size > 5.megabytes }

  def self.for(group, kind) = group.document_templates.find_by(kind: kind) || group.document_templates.new(kind: kind)

  def blank? = mark == "none" && header_text.blank? && subheader_text.blank? && footer_text.blank?

  def mark_url
    image = mark == "seal" ? seal : mark == "group_logo" ? group.logo : nil
    image&.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(image, only_path: true) : nil
  end

  def as_api_json
    { kind: kind, mark: mark, mark_url: mark_url, header_text: header_text, subheader_text: subheader_text, footer_text: footer_text, align: align,
      seal_url: seal.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(seal, only_path: true) : nil, blank: blank? }
  end
end
