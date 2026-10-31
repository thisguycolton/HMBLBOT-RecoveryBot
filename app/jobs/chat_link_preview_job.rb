# Reads the card for a chat message's first link off the request, since the other site can take
# a few seconds (ChatMessage#take_link_preview!). Active Job's in-process adapter runs it.
class ChatLinkPreviewJob < ApplicationJob
  queue_as :default
  discard_on ActiveJob::DeserializationError

  def perform(message)
    message.take_link_preview! if message.link_outdated?
  end
end
