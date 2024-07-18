import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="poll-countdown"
export default class extends Controller {
  static targets = ["pollCountdown"];

  connect() {
    console.log("Connected!!!");

    this.secondsLeft = this.pollCountdownTarget.dataset.secondsLeftValue;

    const now = new Date().getTime();
    this.endTime = new Date(now + this.secondsLeft * 1000);

    this.pollCountdown = setInterval(this.pollCountdown.bind(this), 250);
  }

  pollCountdown() {
    const now = new Date();
    const secondsRemaining = (this.endTime - now) / 1000;
    if (secondsRemaining <= 0) {
      clearInterval(this.pollCountdown);
      this.pollCountdownTarget.innerHTML = "Countdown is over!";
      return;
    }

    const secondsPerDay = 86400;
    const secondsPerHour = 3600;
    const secondsPerMinute = 60;

    const days = Math.floor(secondsRemaining / secondsPerDay);
    const hours = Math.floor(
      (secondsRemaining % secondsPerDay) / secondsPerHour
    );
    const minutes = Math.floor(
      (secondsRemaining % secondsPerHour) / secondsPerMinute
    );
    const seconds = Math.floor(secondsRemaining % secondsPerMinute);

    this.pollCountdownTarget.innerHTML = `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`;
  }
}
