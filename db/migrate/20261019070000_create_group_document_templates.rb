# The letterhead a group's documents of one kind print with: a logo or seal, a heading line
# and a footer. One per group and folder (GroupDocument::KINDS).
class CreateGroupDocumentTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :group_document_templates do |t|
      t.references :group, null: false, foreign_key: true
      t.string :kind, null: false
      t.string :mark, null: false, default: "none" # none | group_logo | seal
      t.string :header_text
      t.string :subheader_text
      t.string :footer_text
      t.string :align, null: false, default: "center"
      t.timestamps
    end
    add_index :group_document_templates, %i[group_id kind], unique: true
  end
end
