# Documents are written in a word-processor style editor now (sanitized HTML). The ones
# already here are Markdown and stay that way until someone opens and saves them.
class AddBodyFormatToGroupDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :group_documents, :body_format, :string, null: false, default: "markdown"
    add_column :group_document_versions, :body_format, :string, null: false, default: "markdown"
    reversible do |dir|
      dir.up do
        change_column_default :group_documents, :body_format, from: "markdown", to: "html"
        change_column_default :group_document_versions, :body_format, from: "markdown", to: "html"
      end
      dir.down { nil }
    end
  end
end
