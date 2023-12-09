class Topic < ApplicationRecord
  def self.ransackable_attributes(auth_object = nil)
    ["created_at", "id", "searchable_number", "title", "updated_at"]
  end
    def self.ransackable_associations(auth_object = nil)
    []
  end
end
