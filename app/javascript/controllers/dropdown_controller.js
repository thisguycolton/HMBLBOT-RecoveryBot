// app/javascript/controllers/dropdown_controller.js
import { Controller } from "@hotwired/stimulus"
import Dropdown from "stimulus-dropdown"

export default class extends Dropdown {
  connect() {
    super.connect()
    console.log("Dropdown controller connected")
  }
}
