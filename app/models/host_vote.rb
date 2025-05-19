class HostVote < ApplicationRecord
  belongs_to :hostificator
  belongs_to :host_prop
end
