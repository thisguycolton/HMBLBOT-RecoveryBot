# How far along a picture or video being drawn is (QuoteCard), so the page can show a
# progress ring while it waits (GET /api/card_progress/:token).
#
# The page makes up a token, sends it with the picture's request (?progress=), and asks about
# it while the picture is drawn. Kept in this process's memory: the server is one Puma process
# (VIDEO_LOCK assumes the same), and a progress note is only any use for half a minute.
class CardProgress
  TOKEN = /\A[A-Za-z0-9_-]{12,64}\z/
  KEEP = 5.minutes
  STAGES = %w[waiting drawing encoding done].freeze

  @notes = {}
  @lock = Mutex.new

  class << self
    # A progress note for this person's token, or nil when the token doesn't look like one
    def for(token, user_id)
      return nil unless token.is_a?(String) && token.match?(TOKEN)

      new("#{user_id}:#{token}")
    end

    # { stage:, percent: } for this person's token, or nil when nothing's been noted
    def read(token, user_id)
      return nil unless token.is_a?(String) && token.match?(TOKEN)

      @lock.synchronize { @notes["#{user_id}:#{token}"]&.slice(:stage, :percent) }
    end

    def write(key, stage, percent)
      @lock.synchronize do
        now = Time.current
        @notes.delete_if { |_, note| note[:at] < now - KEEP } if @notes.size > 50
        last = @notes[key]
        # Never backwards: a ring that slips back looks broken
        percent = [percent, last[:percent]].max if last && STAGES.index(stage) >= STAGES.index(last[:stage])
        @notes[key] = { stage: stage, percent: percent, at: now }
      end
    end

    def clear! = @lock.synchronize { @notes.clear }
  end

  def initialize(key)
    @key = key
  end

  # `fraction` of the whole job (0..1) done, at `stage`
  def update(stage, fraction = 0)
    self.class.write(@key, stage.to_s, (fraction.to_f.clamp(0, 1) * 100).round)
  end
end
