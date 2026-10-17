class Api::V1::QuestLogEntriesController < ApplicationController
  MAX_BATCH = 100

  # POST /api/v1/quest_sessions/:quest_session_id/log_entries  { entries: [...] }
  def create
    session = QuestSession.find(params[:quest_session_id])
    entries = Array(params[:entries]).first(MAX_BATCH).map do |raw|
      e = raw.permit(:kind, :encounter, :topic_id, :sharing_mode_key, :approach, data: {})
      session.quest_log_entries.new(e.merge(data: (e[:data] || {}).to_h))
    end

    if entries.all?(&:valid?)
      QuestLogEntry.transaction { entries.each(&:save!) }
      render json: { saved: entries.size }, status: :created
    else
      render json: { errors: entries.reject(&:valid?).map { |e| e.errors.full_messages } }, status: :unprocessable_entity
    end
  end
end
