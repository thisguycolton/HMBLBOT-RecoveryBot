# Turns away racist slurs and hate speech (BlockedLanguage) in the fields people write, on
# create and on every edit, with an error on the field rather than changing what they wrote.
#
#   class ChatMessage < ApplicationRecord
#     moderates_language :body
#   end
#
# Works on text/string columns, JSON columns (every string inside), Action Text fields and
# plain methods. A column is only checked when it's new or changed, so an old record that
# already has something in it can still be edited elsewhere.
module ModeratesLanguage
  extend ActiveSupport::Concern

  class_methods do
    def moderates_language(*attributes)
      attributes = attributes.map(&:to_s)
      validate do
        attributes.each do |attribute|
          next unless language_check_needed?(attribute)

          errors.add(attribute, BlockedLanguage.message) if BlockedLanguage.found?(*language_check_texts(public_send(attribute)))
        end
      end
    end
  end

  private

  def language_check_needed?(attribute)
    return new_record? || will_save_change_to_attribute?(attribute) if has_attribute?(attribute)

    value = public_send(attribute)
    return value.new_record? || value.changed? if value.respond_to?(:changed?) && value.respond_to?(:new_record?)

    true
  end

  def language_check_texts(value)
    case value
    when nil then []
    when String then [value]
    when Hash, Array then BlockedLanguage.strings_in(value)
    else
      if value.respond_to?(:body) && value.body.respond_to?(:to_html)
        [value.body.to_html] # Action Text
      else
        [value.to_s]
      end
    end
  end
end
