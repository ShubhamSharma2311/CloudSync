// One-off DB bootstrap: ensures the cloudsync_dev database exists, then
// enables the pgvector extension inside it. Idempotent — safe to re-run.
const { Client } = require("pg");

const PG_HOST_URL = process.argv[2];
const TARGET_DB = process.argv[3] || "cloudsync_dev";
if (!PG_HOST_URL) {
  console.error("usage: node setup_db.js '<postgres-system-db-url>' [target-db-name]");
  process.exit(2);
}

const sslOpt = PG_HOST_URL.includes("sslmode=no-verify") || PG_HOST_URL.includes("sslmode=require")
  ? { rejectUnauthorized: false }
  : false;

async function step(label, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`  ✓ ${label}  (${Date.now() - start}ms)`, result ?? "");
  } catch (err) {
    console.log(`  ✗ ${label}  (${Date.now() - start}ms)`);
    console.log(`    code:    ${err.code}`);
    console.log(`    message: ${err.message}`);
    throw err;
  }
}

(async () => {
  const sysClient = new Client({ connectionString: PG_HOST_URL, ssl: sslOpt });
  await sysClient.connect();
  console.log(`Connected to system database (${PG_HOST_URL.split("@")[1]?.split("?")[0] ?? "?"})`);

  await step("check pgvector available", async () => {
    const r = await sysClient.query(
      "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'vector';"
    );
    if (r.rowCount === 0) {
      throw new Error("pgvector not available on this server");
    }
    return r.rows[0];
  });

  await step(`ensure database "${TARGET_DB}" exists`, async () => {
    const r = await sysClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [TARGET_DB]);
    if (r.rowCount === 0) {
      await sysClient.query(`CREATE DATABASE "${TARGET_DB}"`);
      return "(created)";
    }
    return "(already exists)";
  });

  await sysClient.end();

  // Connect to the target DB to install the extension inside it.
  const targetUrl = PG_HOST_URL.replace(/\/postgres(\?|$)/, `/${TARGET_DB}$1`);
  const targetClient = new Client({ connectionString: targetUrl, ssl: sslOpt });
  await targetClient.connect();
  console.log(`Connected to "${TARGET_DB}"`);

  await step("enable pgvector extension", async () => {
    await targetClient.query("CREATE EXTENSION IF NOT EXISTS vector");
  });

  await step("verify extension installed", async () => {
    const r = await targetClient.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
    );
    if (r.rowCount === 0) {
      throw new Error("pgvector still not installed after CREATE EXTENSION");
    }
    return r.rows[0];
  });

  await targetClient.end();
  console.log("\nDone. Use this DATABASE_URL in .env:");
  console.log(`  ${targetUrl}`);
})().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
