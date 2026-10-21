# Pushes a new Notification to the account's devices off the request (Notification#push_later).
# Active Job's in-process adapter runs it; there's no separate job runner.
class WebPushJob < ApplicationJob
  queue_as :default
  discard_on ActiveJob::DeserializationError

  def perform(notification)
    WebPushSender.deliver(notification)
  end
end
