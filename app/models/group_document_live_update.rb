# One edit someone made to a document while editing it live (Yjs bytes), kept until a browser
# folds it into GroupDocument#live_state. See GroupDocument::Live.
class GroupDocumentLiveUpdate < ApplicationRecord
  belongs_to :group_document
  belongs_to :user, optional: true
end
