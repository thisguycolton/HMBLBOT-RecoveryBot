import { Application } from "@hotwired/stimulus"
import "popper"
import "bootstrap"
// Initialize Stimulus application
window.Stimulus = Application.start()

// Import all Stimulus controllers
import DropdownController from "./controllers/dropdown_controller"
window.Stimulus.register("dropdown", DropdownController)

import PollCountdownController from "./controllers/poll_countdown_controller.js"
window.Stimulus.register("poll-countdown", PollCountdownController)

//= require js.cookie
//= require browser_timezone_rails/set_time_zone