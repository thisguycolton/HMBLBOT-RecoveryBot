class EventMailer < ApplicationMailer
  default from: "support@hmblbot.com"

  # An update for someone following an event: "<event> has an update for you!"
  def update_posted
    @update = params[:update]
    @rsvp = params[:rsvp]
    @event = @update.event
    @url = "#{root_url.chomp('/')}#{@event.path}"
    @stop_url = "#{root_url.chomp('/')}/events/#{@event.token}/unsubscribe?t=#{@rsvp.token}"
    mail(to: @rsvp.deliver_to, subject: @update.notification_title)
  end
end
