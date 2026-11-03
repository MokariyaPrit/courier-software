/**
 * One-shot migration: ensure T&C columns exist on user_info and
 * set default Terms & Conditions (+ related numeric defaults).
 *
 * Run: pnpm --filter @courier/api migrate:terms
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { defaultTermsAndConditions } from '../common/utils/terms-and-conditions';

async function ensureColumn(
  ds: DataSource,
  table: string,
  column: string,
  ddl: string,
) {
  const rows = await ds.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [table, column],
  );
  if (!rows.length) {
    await ds.query(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
    console.log(`Added column ${table}.${column}`);
  } else {
    console.log(`Column ${table}.${column} already exists`);
  }
}

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || 5432),
    username: process.env.DATABASE_USER || 'courier',
    password: process.env.DATABASE_PASSWORD || 'courier',
    database: process.env.DATABASE_NAME || 'courier_erp',
  });

  await ds.initialize();

  try {
    await ensureColumn(
      ds,
      'user_info',
      'termsAndConditions',
      `"termsAndConditions" jsonb NULL`,
    );
    await ensureColumn(
      ds,
      'user_info',
      'insurancePercent',
      `"insurancePercent" numeric(8,2) NOT NULL DEFAULT 2`,
    );
    await ensureColumn(
      ds,
      'user_info',
      'paymentDays',
      `"paymentDays" int NOT NULL DEFAULT 10`,
    );
    await ensureColumn(
      ds,
      'user_info',
      'volumetricDivisor',
      `"volumetricDivisor" int NOT NULL DEFAULT 5000`,
    );
    await ensureColumn(
      ds,
      'user_info',
      'ewayBillThreshold',
      `"ewayBillThreshold" numeric(14,2) NOT NULL DEFAULT 50000`,
    );

    const termsJson = JSON.stringify(defaultTermsAndConditions());

    // Refresh defaults for every profile (null / empty / previous saved defaults).
    const result = await ds.query(
      `
      UPDATE "user_info"
      SET
        "termsAndConditions" = $1::jsonb,
        "insurancePercent" = COALESCE("insurancePercent", 2),
        "paymentDays" = COALESCE("paymentDays", 10),
        "volumetricDivisor" = COALESCE("volumetricDivisor", 5000),
        "ewayBillThreshold" = COALESCE("ewayBillThreshold", 50000)
      `,
      [termsJson],
    );

    const updated =
      typeof result === 'object' && result != null && 'rowCount' in result
        ? (result as { rowCount?: number }).rowCount
        : Array.isArray(result)
          ? result.length
          : undefined;

    console.log(
      `Updated default Terms & Conditions on user_info` +
        (updated != null ? ` (${updated} rows)` : ''),
    );
    console.log(`Clauses: ${defaultTermsAndConditions().length}`);
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
