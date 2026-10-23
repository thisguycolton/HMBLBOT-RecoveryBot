# The page that holds the events React app (app/javascript/entrypoints/events.jsx): an
# event's public page, and the HMBLBOT Editor at /events/:token/edit.
class EventsController < ApplicationController
  layout "reader"
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  def app
    @event = Event.find_by(token: params[:token])
    @share = @event && ShareMeta.safely { ShareMeta.event(@event) }
    authenticate_user! if params[:path] == "edit"
  end

  # GET /events/:token/unsubscribe?t= -> the "Stop updates" link in update emails
  def unsubscribe
    event = Event.find_by(token: params[:token])
    rsvp = event && event.rsvps.find_by(token: params[:t].to_s)
    rsvp&.update!(status: "not_going")
    redirect_to(event ? event.path : root_path,
                notice: rsvp ? "You won't get any more updates about #{event.title}." : "That link doesn't work anymore.")
  end
end
