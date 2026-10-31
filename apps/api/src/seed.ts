import 'reflect-metadata';
import { Role } from '@courier/shared';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { UserInfo } from './entities/user-info.entity';
import { Customer } from './entities/customer.entity';
import { Pincode } from './entities/pincode.entity';
import { Consignment } from './entities/consignment.entity';
import { ConsignmentCharge } from './entities/consignment-charge.entity';
import { TrackingEvent } from './entities/tracking-event.entity';
import { Invoice } from './entities/invoice.entity';

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
      Pincode,
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
        state: 'MH',
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
        state: 'MH',
        pincode: '400053',
        address: 'Ops desk',
        gstin: null,
        isActive: true,
      }),
    );
  }

  console.log('Seed complete (no branches table)');
  console.log(`Admin: ${admin.email}`);
  console.log(`Branch Manager: ${bm.email}`);
  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
