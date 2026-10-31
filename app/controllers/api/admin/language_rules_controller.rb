# Site Admin > Blocked words: the list BlockedLanguage checks everything people write against.
class Api::Admin::LanguageRulesController < Api::Admin::SuiteController
  def index
    render json: { rules: LanguageRule.includes(:created_by).order(:kind, :term).map(&:as_admin_json) }
  end

  def create
    rule = LanguageRule.new(params.require(:language_rule).permit(:kind, :term, :note).merge(created_by: current_user))
    rule.save ? render(json: rule.as_admin_json, status: :created) : render_errors(rule)
  end

  def destroy
    rule = LanguageRule.find(params[:id])
    if rule.kind != "allowed" && LanguageRule.where.not(kind: "allowed").count == 1
      return render(json: { error: "That's the last blocked word. Add another before removing it." }, status: :unprocessable_entity)
    end

    rule.destroy!
    head :no_content
  end

  # POST { text } -> { blocked:, found: } - would this be turned away?
  def check
    found = BlockedLanguage.match(params[:text].to_s.first(20_000))
    render json: { blocked: found.present?, found: found&.strip }
  end
end
