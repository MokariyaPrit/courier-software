import { Module, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Consignment } from '../entities/consignment.entity';
import { Invoice } from '../entities/invoice.entity';
import { ConsignmentsController } from './consignments.controller';
import { ConsignmentsService } from './consignments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consignment, Invoice]),
  ],
  controllers: [ConsignmentsController],
  providers: [ConsignmentsService],
  exports: [ConsignmentsService],
})
export class ConsignmentsModule implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** One-time: copy FREIGHT → consignments.price, then drop charges table. */
  async onModuleInit() {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      const chargesExist = await qr.hasTable('consignment_charges');
      if (!chargesExist) return;

      await qr.query(`
        UPDATE consignments AS c
        SET price = src.amount
        FROM (
          SELECT DISTINCT ON ("consignmentId")
            "consignmentId",
            amount
          FROM consignment_charges
          WHERE type = 'FREIGHT'
            AND "deletedAt" IS NULL
          ORDER BY "consignmentId", "createdAt" DESC
        ) AS src
        WHERE c.id = src."consignmentId"
          AND COALESCE(c.price, 0) = 0
      `);

      await qr.query(`DROP TABLE IF EXISTS consignment_charges CASCADE`);
    } finally {
      await qr.release();
    }
  }
}
