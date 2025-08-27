class Chapter < ApplicationRecord
  belongs_to :book
  has_many :user_highlights, dependent: :destroy

  validates :slug, presence: true, uniqueness: { scope: :book_id }
  validates :index, presence: true

  def self.ransackable_attributes(auth_object = nil)
    ["book_id", "content", "created_at", "id", "number", "title", "updated_at"]
  end
  scope :ordered, -> { order(index: :asc) }


  # tiptap_json is a jsonb column holding { type: 'doc', content: [...] }
  def paragraph_count
    nodes = (tiptap_json.is_a?(Hash) ? tiptap_json['content'] : nil) || []
    nodes.count { |n| n.is_a?(Hash) && n['type'] == 'paragraph' }
  end

  # (optional) page breaks count – handy for progress bars or TOCs
  def page_break_count
    nodes = (tiptap_json.is_a?(Hash) ? tiptap_json['content'] : nil) || []
    nodes.count { |n| n.is_a?(Hash) && n['type'] == 'pageBreak' }
  end
end
