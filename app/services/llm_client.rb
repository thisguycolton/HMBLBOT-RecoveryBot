require "net/http"
require "json"

# A small client for OpenAI-compatible chat completions, used by ACID QUEST's storyteller and
# prompt drafting. Every free tier is small (Gemini: ~20 requests a day per model; OpenRouter
# free models: 50 a day, and popular ones are often busy), so each job has a *chain* of
# provider:model entries and moves down it whenever one is busy, out of quota or unavailable.
#
#   QUEST_AI_STORY_CHAIN / QUEST_AI_DRAFT_CHAIN   comma-separated "provider:model" (defaults below)
#   GEMINI_API_KEY       (or credentials gemini.api_key)
#   OPENROUTER_API_KEY   (or credentials openrouter.api_key)
#   OLLAMA_URL           local Ollama, default http://localhost:11434/v1 (no key)
#
# Entries whose provider has no key are skipped. Only structured journey facts and topic titles
# are ever sent - never anything about people. Free tiers may use what's sent to train models.
class LlmClient
  PROVIDERS = {
    "gemini" => { base_url: "https://generativelanguage.googleapis.com/v1beta/openai", key_env: "GEMINI_API_KEY", credentials: :gemini },
    "openrouter" => { base_url: "https://openrouter.ai/api/v1", key_env: "OPENROUTER_API_KEY", credentials: :openrouter },
    "ollama" => { base_url: "http://localhost:11434/v1", url_env: "OLLAMA_URL", key_env: nil },
  }.freeze

  # Tales get Gemini 3.8 Flash first (the best writer); drafting starts elsewhere so a bulk run
  # doesn't spend the day's tales.
  DEFAULT_CHAINS = {
    story: "gemini:gemini-3.8-flash, openrouter:dots-studio/dots-3-note-preview:free, gemini:gemini-3.5-flash, openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",
    draft: "gemini:gemini-3.5-flash, openrouter:dots-studio/dots-3-note-preview:free, openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",
  }.freeze

  class Error < StandardError; end
  class NotConfigured < Error; end
  class RateLimited < Error
    attr_reader :retry_after, :daily
    # daily: a per-day quota is used up (as opposed to a short per-minute or busy-pool limit)
    def initialize(message, retry_after: nil, daily: false)
      super(message)
      @retry_after = retry_after
      @daily = daily
    end
  end
  class Unavailable < Error; end   # 5xx, timeouts, connection problems
  class BadResponse < Error; end   # other 4xx, or a reply we can't use

  Endpoint = Struct.new(:provider, :model, :base_url, :api_key, keyword_init: true) do
    def label = "#{provider}:#{model}"
  end

  # The usable endpoints for a job (:story or :draft), in order
  def self.chain(purpose, spec = nil)
    spec ||= ENV["QUEST_AI_#{purpose.to_s.upcase}_CHAIN"].presence || DEFAULT_CHAINS.fetch(purpose)
    spec.split(",").map(&:strip).reject(&:empty?).filter_map do |entry|
      provider, model = entry.split(":", 2)
      config = PROVIDERS[provider] or next
      key = config[:key_env] && (ENV[config[:key_env]].presence || Rails.application.credentials.dig(config[:credentials], :api_key).presence)
      next if config[:key_env] && key.nil?
      base = (config[:url_env] && ENV[config[:url_env]].presence) || config[:base_url]
      Endpoint.new(provider: provider, model: model, base_url: base.chomp("/"), api_key: key)
    end
  end

  def self.configured?(purpose = :story)
    chain(purpose).any?
  end

  # the endpoint that answered the last request
  attr_reader :last_endpoint

  # purpose: :story or :draft (uses that chain); or pass endpoints: [Endpoint, ...] directly
  def initialize(purpose: :story, chain: nil, endpoints: nil, timeout: 120, retries: 2)
    @endpoints = endpoints || self.class.chain(purpose, chain)
    raise NotConfigured, "No AI provider set up (GEMINI_API_KEY / OPENROUTER_API_KEY)" if @endpoints.empty?
    @timeout = timeout
    @retries = retries
  end

  def models = @endpoints.map(&:label)
  def last_model = @last_endpoint&.model

  # Returns the reply text, or with schema: (a JSON Schema hash) the parsed JSON as a Hash.
  # effort: reasoning effort, sent only to providers that take it (Gemini).
  # accept: optional check on the reply; a reply it rejects counts as a failure and the chain
  # moves on. max_tokens must leave room for reasoning models' thinking, which counts too.
  def chat(system:, user:, schema: nil, schema_name: "reply", max_tokens: 2000, effort: nil, accept: nil)
    body = { messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: max_tokens }
    body[:response_format] = { type: "json_schema", json_schema: { name: schema_name, schema: schema, strict: true } } if schema

    errors = []
    @endpoints.each_with_index do |endpoint, i|
      last = i == @endpoints.size - 1
      @last_endpoint = endpoint
      request = body.merge(model: endpoint.model)
      request[:reasoning_effort] = effort if effort && endpoint.provider == "gemini"
      begin
        # every attempt spends a free request, so only the last endpoint retries busy errors
        reply = reply_from(post(endpoint, request, retry_unavailable: last), schema)
        raise BadResponse, "Reply didn't pass its check" if accept && !accept.call(reply)
        return reply
      rescue Error => e
        Rails.logger.info("[llm] #{endpoint.label}: #{e.class} #{e.message[0, 200]}")
        errors << e
      end
    end
    raise combined(errors)
  end

  private

  def reply_from(data, schema)
    choice = data.dig("choices", 0) or raise BadResponse, "No choices in reply"
    text = choice.dig("message", "content").to_s
    raise BadResponse, "Reply was cut off (#{choice['finish_reason']})" if choice["finish_reason"] == "length"
    raise BadResponse, "Empty reply (#{choice['finish_reason'] || 'no reason given'})" if text.strip.empty?
    schema ? parse_json(text) : text.strip
  end

  # All out of quota for the day -> a daily RateLimited; all limited -> RateLimited; else the last
  def combined(errors)
    limited = errors.grep(RateLimited)
    return errors.last unless limited.size == errors.size
    RateLimited.new(errors.last.message, daily: limited.all?(&:daily))
  end

  def post(endpoint, body, retry_unavailable: true)
    uri = URI("#{endpoint.base_url}/chat/completions")
    attempts = 0
    begin
      attempts += 1
      request = Net::HTTP::Post.new(uri, "Content-Type" => "application/json")
      request["Authorization"] = "Bearer #{endpoint.api_key}" if endpoint.api_key.present?
      request["X-Title"] = "RecoveryBot ACID QUEST" if endpoint.provider == "openrouter"
      request.body = body.to_json
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 10, read_timeout: @timeout) do |http|
        http.request(request)
      end
      handle(response)
    rescue RateLimited => e
      # per-minute limits clear quickly; a used-up day or a busy shared pool doesn't
      raise if e.daily || e.retry_after.nil? || e.retry_after > 60 || attempts > @retries
      sleep(e.retry_after.clamp(1, 60))
      retry
    rescue Unavailable => e
      raise if !retry_unavailable || attempts > @retries
      sleep(2**attempts)
      retry
    rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNREFUSED, Errno::ECONNRESET, SocketError, OpenSSL::SSL::SSLError => e
      raise Unavailable, "#{e.class}: #{e.message}" if !retry_unavailable || attempts > @retries
      sleep(2**attempts)
      retry
    end
  end

  def handle(response)
    code = response.code.to_i
    data = parse_body(response.body)
    # OpenRouter reports upstream failures inside a 200 as { error: {...} }
    code = data.dig("error", "code").to_i if code == 200 && data.is_a?(Hash) && data["error"].is_a?(Hash) && data.dig("error", "code").to_i >= 400
    return data if code.between?(200, 299)

    error = (data.is_a?(Array) ? data.first : data).then { |d| d.is_a?(Hash) ? d["error"] || {} : {} }
    message = [error["message"], error.dig("metadata", "raw")].compact.join(" - ").presence || response.body.to_s[0, 300]
    details = Array(error["details"])
    case code
    when 429
      # Gemini: QuotaFailure details name the quota; OpenRouter: "free-models-per-day"
      daily = details.any? { |d| Array(d["violations"]).any? { |v| v["quotaId"].to_s.include?("PerDay") } } || message.match?(/per[- ]day/i)
      delay = details.filter_map { |d| d["retryDelay"] }.first&.to_f || response["retry-after"]&.to_f
      raise RateLimited.new("Rate limited: #{message.lines.first&.strip}", retry_after: delay, daily: daily)
    when 500..599 then raise Unavailable, "Provider error #{code}: #{message}"
    else raise BadResponse, "Request failed #{code}: #{message}"
    end
  end

  def parse_body(body)
    JSON.parse(body)
  rescue JSON::ParserError
    raise BadResponse, "Reply wasn't JSON"
  end

  # Some models wrap JSON in a code fence even when asked not to
  def parse_json(text)
    JSON.parse(text.strip.sub(/\A```(?:json)?\s*/, "").sub(/\s*```\z/, ""))
  rescue JSON::ParserError
    raise BadResponse, "Reply wasn't valid JSON"
  end
end
