# Who sees a note or highlight on its owner's profile: only them ("private", the default),
# the people following them, or everyone who can see profiles. `owner_key` is the column
# naming its owner. Notes shared to a group are also seen by that group's members, whatever
# this says (TimelineNoteShare).
module Visibility
  extend ActiveSupport::Concern

  LEVELS = %w[private followers public].freeze

  included do
    validates :visibility, inclusion: { in: LEVELS }
  end

  class_methods do
    # What `viewer` may see of `owner`'s
    def visible_to(viewer, owner:)
      return where(user_id: owner.id) if viewer&.id == owner.id
      return none unless viewer && User.profiles_open_to?(viewer)

      levels = Follow.exists?(follower_id: viewer.id, followed_id: owner.id) ? %w[followers public] : %w[public]
      where(user_id: owner.id, visibility: levels)
    end
  end
end
