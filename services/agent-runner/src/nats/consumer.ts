import { connect, StringCodec, consumerOpts, createInbox, Events } from "nats";

const sc = StringCodec();

export async function runConsumer(natsUrl: string) {
  const nc = await connect({ servers: natsUrl });
  const js = nc.jetstream();

  const opts = consumerOpts();
  opts.durable("agent-runner-v0");
  opts.manualAck();
  opts.ackExplicit();
  opts.deliverTo(createInbox());
  opts.callback((err, msg) => {
    if (err) {
      console.error("consumer error", err);
      return;
    }
    const s = sc.decode(msg.data);
    console.log("[agent-runner] got", msg.subject, s);
    msg.ack();
  });
  opts.filterSubject("twin.>");

  const sub = await js.subscribe("twin.>", opts);

  (async () => {
    for await (const _ of sub) {
      // callback mode handles messages
    }
  })().catch(console.error);

  nc.status().then(async (it) => {
    for await (const s of it) {
      if (s.type === Events.Disconnect) console.warn("nats disconnect");
    }
  });

  return nc;
}
