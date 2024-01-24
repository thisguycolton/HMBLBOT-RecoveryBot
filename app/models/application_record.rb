class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class
  def ransackable_attributes(auth_object = nil)
    column_names + _ransackers.keys
  end
  def ransackable_associations(auth_object = nil)
    reflect_on_all_associations.map { |a| a.name.to_s }
  end
end
