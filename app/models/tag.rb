class Tag < ApplicationRecord
  has_many :reading_tags, dependent: :destroy
  has_many :readings, through: :reading_tags

  validates :title, presence: true, uniqueness: true
  before_validation :set_slug

  private

  def set_slug
    self.slug = title.to_s.parameterize if slug.blank?
  end
end
