import 'dotenv/config';
import { Client } from 'pg';

async function run() {
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER || 'courier',
    password: process.env.DATABASE_PASSWORD || 'courier',
    database: process.env.DATABASE_NAME || 'courier_erp',
  });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
  console.log('Database schema reset complete');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
