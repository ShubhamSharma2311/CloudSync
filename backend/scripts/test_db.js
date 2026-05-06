// One-off DB connectivity check — not part of the app. Reads connection
// string from argv[2], runs SELECT 1 + version, prints result, exits.
const { Client } = require("pg");

const url = process.argv[2];
if (!url) {
  console.error("usage: node test_db.js '<DATABASE_URL>'");
  process.exit(2);
}

// Honor sslmode in the URL; for `no-verify` we explicitly skip cert chain validation.
const ssl = url.includes("sslmode=no-verify") || url.includes("sslmode=require")
  ? { rejectUnauthorized: false }
  : false;
const client = new Client({ connectionString: url, ssl });

(async () => {
  const start = Date.now();
  try {
    await client.connect();
    const select = await client.query("SELECT 1 AS one, current_database() AS db, current_user AS usr, version() AS version;");
    const row = select.rows[0];
    console.log(JSON.stringify({
      ok: true,
      durationMs: Date.now() - start,
      ...row,
      version: row.version.split(",")[0],
    }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({
      ok: false,
      durationMs: Date.now() - start,
      code: err.code,
      message: err.message,
    }, null, 2));
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
