class UserActiveGroup < ApplicationRecord
  belongs_to :user
  belongs_to :group
end
