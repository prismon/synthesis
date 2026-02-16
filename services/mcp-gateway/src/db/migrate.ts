import { pool } from "./client.js";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const dir = path.resolve(process.cwd(), "dist/db/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("COMMIT");
      console.log(`applied ${f}`);
    } catch (e) {
      await pool.query("ROLLBACK");
      throw e;
    }
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
