module ApplicationHelper
  # vite_rails links a page's stylesheets as media="screen" unless told otherwise, which leaves
  # every @media print rule (the paper agenda, Save as PDF, court verification) unloaded
  def vite_javascript_tag(*names, **options)
    super(*names, **{ media: "all" }.merge(options))
  end

  def dynamic_fields_for form, association, name = "Add"
    # stimulus:      controller v
    tag.div data: {controller: "dynamic-fields"} do
      safe_join([
        # render existing fields
        form.fields_for(association) do |ff|
          yield ff
        end,

        # render "Add" button that will call `add()` function
        # stimulus:         `add(event)` v
         button_tag(name, type: 'button', data: { action: "dynamic-fields#add" }),

        # render "<template>"
        # stimulus:           `this.templateTarget` v
        tag.template(data: {dynamic_fields_target: "template"}) do
          form.fields_for association, association.to_s.classify.constantize.new,
            child_index: "__CHILD_INDEX__" do |ff|
              #           ^ make it easy to gsub from javascript
              yield ff
          end
        end
      ])
    end
  end
end
