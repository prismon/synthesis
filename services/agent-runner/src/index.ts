import { runConsumer } from "./nats/consumer.js";

const natsUrl = process.env.NATS_URL ?? "nats://localhost:4222";

runConsumer(natsUrl).then((nc) => {
  console.log("agent-runner connected");
  process.on("SIGINT", async () => {
    await nc.drain();
    process.exit(0);
  });
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
