class Hostificator < ApplicationRecord
  has_many :host_props, dependent: :destroy
  has_many :host_votes, dependent: :destroy

  accepts_nested_attributes_for :host_props, allow_destroy: true
end
