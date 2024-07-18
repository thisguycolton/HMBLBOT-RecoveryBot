// app/javascript/controllers/dynamic_fields_controller.js
import { Controller } from "stimulus"

export default class extends Controller {
  static targets = ["template"]

  connect() {
    console.log("Dynamic fields controller connected")
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
 