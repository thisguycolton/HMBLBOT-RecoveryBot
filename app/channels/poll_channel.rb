# A poll's open pages hear when anything about it changes (a vote, an edit, closing) and fetch it
# again from Api::PollsController, which decides what each viewer may see (results, names). The
# message carries nothing else, so it stays tiny and private.
class PollChannel < ApplicationCable::Channel
  def subscribed
    poll = Poll.find_by(token: params[:token].to_s)
    poll ? stream_for(poll) : reject
  end
end
