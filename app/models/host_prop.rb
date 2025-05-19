class HostProp < ApplicationRecord
  belongs_to :hostificator
  has_many :host_votes
end
