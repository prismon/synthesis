import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "../config.js";

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
export const db = drizzle(pool);
