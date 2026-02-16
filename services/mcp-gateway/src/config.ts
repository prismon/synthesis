import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  NATS_URL: z.string().min(1),
  PORT: z.string().default("8080")
});

export const config = Env.parse(process.env);
