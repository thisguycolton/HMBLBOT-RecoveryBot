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

  # Opening paragraph text (headings skipped), for table-of-contents thumbnails.
  def preview(limit = 360)
    text = +""
    each_tiptap_block do |node|
      next unless node["type"] == "paragraph"
      line = tiptap_text(node).squish
      next if line.empty?
      text << " " unless text.empty?
      text << line
      break if text.length >= limit
    end
    text.truncate(limit, separator: " ")
  end

  def word_count
    count = 0
    each_tiptap_block { |node| count += tiptap_text(node).split.size unless node["type"] == "heading" }
    count
  end

  # (optional) page breaks count – handy for progress bars or TOCs
  def page_break_count
    nodes = (tiptap_json.is_a?(Hash) ? tiptap_json['content'] : nil) || []
    nodes.count { |n| n.is_a?(Hash) && n['type'] == 'pageBreak' }
  end

  private

  def each_tiptap_block(&block)
    nodes = (tiptap_json.is_a?(Hash) ? tiptap_json["content"] : nil) || []
    nodes.each { |n| yield n if n.is_a?(Hash) }
  end

  def tiptap_text(node)
    return node["text"].to_s if node["type"] == "text"
    Array(node["content"]).map { |child| child.is_a?(Hash) ? tiptap_text(child) : "" }.join
  end
end
