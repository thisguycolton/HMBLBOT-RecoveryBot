import { Application } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"
import "channels"

// ✅ Turbo-aware bootstrap support
document.addEventListener("turbo:load", () => {
  // Dropdowns
  document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach((el) => {
    new bootstrap.Dropdown(el)
  })

  // Tooltips
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
    new bootstrap.Tooltip(el)
  })
})

// ✅ Stimulus
window.Stimulus = Application.start()

// Stimulus Controllers
import DropdownController from "./controllers/dropdown_controller"
window.Stimulus.register("dropdown", DropdownController)

import PollCountdownController from "./controllers/poll_countdown_controller"
window.Stimulus.register("poll-countdown", PollCountdownController)

// ✅ Rich text
import "@afomera/richer-text"

// ✅ DOM-ready fallback for static JS
document.addEventListener("DOMContentLoaded", () => {
  const iconOptions = document.querySelectorAll(".icon-option")
  iconOptions.forEach((option) => {
    option.addEventListener("click", () => {
      iconOptions.forEach((opt) => opt.classList.remove("selected"))
      option.classList.add("selected")
    })
  })
})