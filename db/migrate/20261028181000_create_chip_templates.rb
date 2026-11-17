# Illustrated chips. Chip templates (ChipTemplate) are art made in the chip art editor
# (ChipArt): site-wide ones made in Site Admin > Chip templates (group_id nil) and a group's own
# imports (only that group sees them). A template is edited as a draft (art, palettes, defaults)
# and each publish freezes a numbered version (chip_template_versions) that designs point at.
#
# Minted chips never change, so chip_design_versions keeps how a group's or a meeting's chips
# looked from each time it changed (Meeting Maker chips are drawn as they were on the day they
# were earned), and a chip a host gives keeps the design it was given in (chip_awards.design).
class CreateChipTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :chip_templates do |t|
      t.references :group, foreign_key: { on_delete: :cascade }
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :title, null: false
      t.string :fits, null: false, default: "round"
      t.string :status, null: false, default: "draft"
      t.string :source, null: false, default: ""
      t.string :license, null: false, default: ""
      t.boolean :hidden, null: false, default: false
      t.jsonb :art, null: false, default: {}
      t.jsonb :palettes, null: false, default: {}
      t.jsonb :defaults, null: false, default: {}
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    create_table :chip_template_versions do |t|
      t.references :chip_template, null: false, foreign_key: { on_delete: :cascade }
      t.integer :number, null: false
      t.jsonb :art, null: false, default: {}
      t.jsonb :palettes, null: false, default: {}
      t.jsonb :defaults, null: false, default: {}
      t.timestamps
      t.index %i[chip_template_id number], unique: true
    end

    create_table :chip_design_versions do |t|
      t.string :owner_type, null: false
      t.bigint :owner_id, null: false
      t.jsonb :design, null: false
      t.datetime :created_at, null: false
      t.index %i[owner_type owner_id created_at]
    end

    add_column :chip_awards, :design, :jsonb
  end
end
