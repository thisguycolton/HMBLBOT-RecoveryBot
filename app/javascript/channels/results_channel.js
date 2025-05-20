import { consumer } from "channels/consumer"

document.addEventListener("turbo:load", () => {
  console.log("📡 Connecting to ResultsChannel…")
  const container = document.getElementById("results-container")
  if (!container) return

  const hostificatorId = container.dataset.hostificatorId

  consumer.subscriptions.create(
    { channel: "ResultsChannel", id: hostificatorId },
    {
      received(data) {
        console.log("📬 Results received via ActionCable")
        container.innerHTML = data
      }
    }
  )
})