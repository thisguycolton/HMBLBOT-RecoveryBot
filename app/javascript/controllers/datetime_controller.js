import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["date", "time", "combined"]

  connect() {
    this.update()
    this.dateTarget.addEventListener("input", () => this.update())
    this.timeTarget.addEventListener("input", () => this.update())
  }

  update() {
    const date = this.dateTarget.value
    const time = this.timeTarget.value

    if (date && time) {
      const combined = new Date(`${date}T${time}`)
      this.combinedTarget.value = combined.toISOString()
    }
  }
}
