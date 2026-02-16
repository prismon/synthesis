import { connect, RetentionPolicy, StringCodec } from "nats";
import { config } from "../config.js";

const sc = StringCodec();

export async function connectJetStream() {
  const nc = await connect({ servers: config.NATS_URL });
  const jsm = await nc.jetstreamManager();
  const js = nc.jetstream();

  try {
    await jsm.streams.info("TWINEVENTS");
  } catch {
    await jsm.streams.add({
      name: "TWINEVENTS",
      subjects: ["twin.>"],
      retention: RetentionPolicy.Limits,
      max_msgs_per_subject: -1,
      max_age: 0
    });
  }

  return { nc, js, jsm, sc };
}

export function subjectForTwin(tenantId: string, twinId: string) {
  return `twin.${tenantId}.${twinId}`;
}
