import { createConsumer } from "@rails/actioncable"

const consumer = createConsumer()
// Force connection (especially helpful with importmap setups)
consumer.connect()

export { consumer }