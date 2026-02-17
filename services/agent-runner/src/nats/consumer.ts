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
    if (!msg) {
      return;
    }
    const s = sc.decode(msg.data);
    console.log("[agent-runner] got", msg.subject, s);
    msg.ack();
  });
  opts.filterSubject("twin.>");

  let sub;
  for (;;) {
    try {
      sub = await js.subscribe("twin.>", opts);
      break;
    } catch (err) {
      console.warn("stream not ready yet, retrying in 1s");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  (async () => {
    for await (const _ of sub) {
      // callback mode handles messages
    }
  })().catch(console.error);

  (async () => {
    for await (const s of nc.status()) {
      if (s.type === Events.Disconnect) console.warn("nats disconnect");
    }
  })().catch(console.error);

  return nc;
}
