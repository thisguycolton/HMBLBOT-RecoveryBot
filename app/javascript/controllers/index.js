// app/javascript/controllers/dynamic_fields_controller.js
import { Application } from "@hotwired/stimulus"
import { definitionsFromContext } from "@hotwired/stimulus-loading"

const application = Application.start()
const context = require.context("controllers", true, /\.js$/)
application.load(definitionsFromContext(context))

import { Controller } from "@hotwired/stimulus"
import Sortable from '@stimulus-components/sortable'

const application = Application.start()
application.register('sortable', Sortable)

export default class extends Controller {
  static targets = ["template"]

  connect() {
    // Any initialization code can go here
  }

  add(event) {
    event.preventDefault()
    const content = this.templateTarget.innerHTML.replace(/__CHILD_INDEX__/g, new Date().getTime())
    this.element.insertAdjacentHTML('beforeend', content)
  }

  remove(event) {
    event.preventDefault()
    let item = event.target.closest('.field')
    item.querySelector('input[name*="_destroy"]').value = 1
    item.style.display = 'none'
  }
}
