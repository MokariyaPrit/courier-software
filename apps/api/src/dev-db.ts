import EmbeddedPostgres from 'embedded-postgres';
import * as path from 'path';

async function main() {
  const databaseDir = path.join(process.cwd(), '.embedded-pg');
  const port = Number(process.env.DATABASE_PORT || 5432);
  const user = process.env.DATABASE_USER || 'courier';
  const password = process.env.DATABASE_PASSWORD || 'courier';
  const database = process.env.DATABASE_NAME || 'courier_erp';

  const pg = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
  });

  await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(database);
  } catch {
    // already exists
  }

  console.log(`Embedded Postgres ready on localhost:${port} db=${database}`);
  console.log('Leave this process running while you use the API.');

  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
