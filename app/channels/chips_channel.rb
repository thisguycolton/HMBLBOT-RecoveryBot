# The signed-in member's own chips: when one someone gave them is theirs (ChipAward#claim!), the
# pages they have open hear about it and show it in a popup with confetti (ChipArrival), no
# refresh needed. The message only says one came; the page asks Api::ChipArrivalsController for it.
class ChipsChannel < ApplicationCable::Channel
  def subscribed
    return reject unless current_user

    stream_for current_user
  end
end
