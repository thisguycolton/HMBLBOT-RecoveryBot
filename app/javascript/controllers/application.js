import { Application } from "@hotwired/stimulus"
import { definitionsFromContext } from "@hotwired/stimulus-loading"

window.Stimulus = Application.start()
Stimulus.load(definitionsFromContext(context))

Turbo.setFormMode("optin")