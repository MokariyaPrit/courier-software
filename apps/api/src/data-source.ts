import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './database/entities';

/**
 * TypeORM CLI DataSource (migrations generate/run).
 * Usage: pnpm --filter @courier/api migration:run
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USER || 'courier',
  password: process.env.DATABASE_PASSWORD || 'courier',
  database: process.env.DATABASE_NAME || 'courier_erp',
  entities: ALL_ENTITIES,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
