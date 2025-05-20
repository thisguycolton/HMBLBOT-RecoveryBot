import { Application } from "@hotwired/stimulus"
import "popper"
import "bootstrap"

import "channels"
// Initialize Stimulus application
window.Stimulus = Application.start()

// Import all Stimulus controllers
import DropdownController from "./controllers/dropdown_controller"
window.Stimulus.register("dropdown", DropdownController)

import PollCountdownController from "./controllers/poll_countdown_controller.js"
window.Stimulus.register("poll-countdown", PollCountdownController)

//= require js.cookie
//= require browser_timezone_rails/set_time_zone

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

import "@afomera/richer-text"

document.addEventListener("DOMContentLoaded", () => {
  const iconOptions = document.querySelectorAll(".icon-option");

  iconOptions.forEach((option) => {
    option.addEventListener("click", () => {
      iconOptions.forEach((opt) => opt.classList.remove("selected"));
      option.classList.add("selected");
    });
  });
});
