import 'reflect-metadata';
import { Role } from '@courier/shared';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Branch, BranchType } from './entities/branch.entity';
import { User } from './entities/user.entity';
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
      Branch,
      User,
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

  const branches = ds.getRepository(Branch);
  const users = ds.getRepository(User);

  let hq = await branches.findOne({ where: { code: 'HQ01' } });
  if (!hq) {
    hq = await branches.save(
      branches.create({
        code: 'HQ01',
        name: 'Head Office Hub',
        type: BranchType.HUB,
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
        address: 'HQ Campus',
        phone: '9999999999',
      }),
    );
  }

  let branch = await branches.findOne({ where: { code: 'BR01' } });
  if (!branch) {
    branch = await branches.save(
      branches.create({
        code: 'BR01',
        name: 'Andheri Branch',
        type: BranchType.BRANCH,
        city: 'Mumbai',
        state: 'MH',
        pincode: '400053',
        address: 'Andheri East',
        phone: '9888888888',
      }),
    );
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@courier.local').toLowerCase();
  const bmEmail = (process.env.SEED_BM_EMAIL || 'manager@courier.local').toLowerCase();

  let admin = await users.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = await users.save(
      users.create({
        email: adminEmail,
        fullName: 'System Admin',
        role: Role.ADMIN,
        branchId: null,
        passwordHash: await bcrypt.hash(
          process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
          10,
        ),
      }),
    );
  }

  let bm = await users.findOne({ where: { email: bmEmail } });
  if (!bm) {
    bm = await users.save(
      users.create({
        email: bmEmail,
        fullName: 'Andheri Manager',
        role: Role.BRANCH_MANAGER,
        branchId: branch.id,
        passwordHash: await bcrypt.hash(
          process.env.SEED_BM_PASSWORD || 'Manager@12345',
          10,
        ),
      }),
    );
  }

  console.log('Seed complete');
  console.log(`Admin: ${admin.email}`);
  console.log(`Branch Manager: ${bm.email} @ ${branch.code}`);
  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
