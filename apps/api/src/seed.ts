import 'reflect-metadata';
import { Role } from '@courier/shared';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { City } from './entities/city.entity';
import { Consignment } from './entities/consignment.entity';
import { ConsignmentCharge } from './entities/consignment-charge.entity';
import { Customer } from './entities/customer.entity';
import { Invoice } from './entities/invoice.entity';
import { State } from './entities/state.entity';
import { TrackingEvent } from './entities/tracking-event.entity';
import { User } from './entities/user.entity';
import { UserInfo } from './entities/user-info.entity';

type SampleRow = { city: string; state: string };

/** Known sample-data typos → canonical name */
const STATE_NAME_FIXES: Record<string, string> = {
  gujrat: 'Gujarat',
};

function canonicalStateName(name: string) {
  const trimmed = name.trim();
  return STATE_NAME_FIXES[trimmed.toLowerCase()] || trimmed;
}

/** Merge typo states (e.g. Gujrat) into the correct state and delete the typo */
async function mergeDuplicateStates(ds: DataSource) {
  const statesRepo = ds.getRepository(State);
  const citiesRepo = ds.getRepository(City);

  for (const [typoKey, correctName] of Object.entries(STATE_NAME_FIXES)) {
    const typo = await statesRepo
      .createQueryBuilder('s')
      .where('LOWER(s.name) = :name', { name: typoKey })
      .getOne();
    if (!typo) continue;

    let correct = await statesRepo
      .createQueryBuilder('s')
      .where('LOWER(s.name) = :name', { name: correctName.toLowerCase() })
      .getOne();
    if (!correct) {
      typo.name = correctName;
      await statesRepo.save(typo);
      console.log(`Renamed state "${typoKey}" → "${correctName}"`);
      continue;
    }

    const typoCities = await citiesRepo.find({ where: { stateId: typo.id } });
    const correctCities = await citiesRepo.find({
      where: { stateId: correct.id },
    });
    const existing = new Set(
      correctCities.map((c) => c.name.toLowerCase()),
    );

    for (const city of typoCities) {
      if (existing.has(city.name.toLowerCase())) {
        await citiesRepo.delete(city.id);
      } else {
        city.stateId = correct.id;
        await citiesRepo.save(city);
        existing.add(city.name.toLowerCase());
      }
    }

    await statesRepo.delete(typo.id);
    console.log(`Merged typo state "${typo.name}" into "${correct.name}"`);
  }
}

async function seedLocations(ds: DataSource) {
  const statesRepo = ds.getRepository(State);
  const citiesRepo = ds.getRepository(City);

  await mergeDuplicateStates(ds);

  const samplePath = path.resolve(__dirname, '../../../sample.data.json');
  if (!fs.existsSync(samplePath)) {
    console.warn(`Sample data not found at ${samplePath}; skipping locations`);
    return;
  }

  const raw = fs
    .readFileSync(samplePath, 'utf8')
    .replace(/^\uFEFF/, '');
  const rows = JSON.parse(raw) as SampleRow[];
  const byState = new Map<string, Set<string>>();
  for (const row of rows) {
    const stateName = canonicalStateName(row.state || '');
    const cityName = row.city?.trim();
    if (!stateName || !cityName) continue;
    if (!byState.has(stateName)) byState.set(stateName, new Set());
    byState.get(stateName)!.add(cityName);
  }

  const existingStates = await statesRepo.find();
  const stateIdByName = new Map(
    existingStates.map((s) => [s.name.toLowerCase(), s.id]),
  );

  for (const stateName of [...byState.keys()].sort()) {
    if (!stateIdByName.has(stateName.toLowerCase())) {
      const saved = await statesRepo.save(
        statesRepo.create({ name: stateName, isActive: true }),
      );
      stateIdByName.set(stateName.toLowerCase(), saved.id);
    }
  }

  let cityInserted = 0;
  for (const [stateName, cities] of byState) {
    const stateId = stateIdByName.get(stateName.toLowerCase());
    if (!stateId) continue;
    // Include state name itself as a city entry under that state
    const cityNames = new Set(cities);
    cityNames.add(stateName);
    const existing = await citiesRepo.find({ where: { stateId } });
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
    const toInsert = [...cityNames]
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name) =>
        citiesRepo.create({ name, stateId, isActive: true }),
      );
    if (toInsert.length) {
      await citiesRepo.save(toInsert, { chunk: 200 });
      cityInserted += toInsert.length;
    }
  }

  // Also ensure every DB state has a same-named city (covers states already present)
  const allStates = await statesRepo.find();
  let stateNamedCities = 0;
  for (const state of allStates) {
    const exists = await citiesRepo.findOne({
      where: { stateId: state.id, name: state.name },
    });
    if (!exists) {
      await citiesRepo.save(
        citiesRepo.create({
          name: state.name,
          stateId: state.id,
          isActive: true,
        }),
      );
      stateNamedCities += 1;
    }
  }

  console.log(
    `Locations: ${byState.size} states, inserted ${cityInserted} cities (+${stateNamedCities} state-name cities)`,
  );
}

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || 5432),
    username: process.env.DATABASE_USER || 'courier',
    password: process.env.DATABASE_PASSWORD || 'courier',
    database: process.env.DATABASE_NAME || 'courier_erp',
    entities: [
      User,
      UserInfo,
      Customer,
      State,
      City,
      Consignment,
      ConsignmentCharge,
      TrackingEvent,
      Invoice,
    ],
    synchronize: true,
  });

  await ds.initialize();

  const users = ds.getRepository(User);
  const userInfo = ds.getRepository(UserInfo);

  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL || 'admin@courier.local'
  ).toLowerCase();
  const bmEmail = (
    process.env.SEED_BM_EMAIL || 'manager@courier.local'
  ).toLowerCase();

  let admin = await users.findOne({
    where: { email: adminEmail },
    relations: ['userInfo'],
  });
  if (!admin) {
    admin = await users.save(
      users.create({
        email: adminEmail,
        role: Role.ADMIN,
        isActive: true,
        passwordHash: await bcrypt.hash(
          process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
          10,
        ),
      }),
    );
    await userInfo.save(
      userInfo.create({
        userId: admin.id,
        fullName: 'System Admin',
        email: adminEmail,
        phone: '9999999999',
        companyName: 'Courier ERP HQ',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        address: 'Head office',
        gstin: null,
        isActive: true,
      }),
    );
  }

  let bm = await users.findOne({
    where: { email: bmEmail },
    relations: ['userInfo'],
  });
  if (!bm) {
    bm = await users.save(
      users.create({
        email: bmEmail,
        role: Role.BRANCH_MANAGER,
        isActive: true,
        passwordHash: await bcrypt.hash(
          process.env.SEED_BM_PASSWORD || 'Manager@12345',
          10,
        ),
      }),
    );
    await userInfo.save(
      userInfo.create({
        userId: bm.id,
        fullName: 'Operations Manager',
        email: bmEmail,
        phone: '9888888888',
        companyName: 'Courier ERP Ops',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400053',
        address: 'Ops desk',
        gstin: null,
        isActive: true,
      }),
    );
  }

  await seedLocations(ds);

  console.log('Seed complete');
  console.log(`Admin: ${admin.email}`);
  console.log(`Branch Manager: ${bm.email}`);
  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
