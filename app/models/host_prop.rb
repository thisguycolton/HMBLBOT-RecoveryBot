class HostProp < ApplicationRecord
  moderates_language :name, :proposed_meeting
  belongs_to :hostificator
  has_many :host_votes
end
