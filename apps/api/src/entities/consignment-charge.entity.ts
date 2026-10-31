import { ChargeType } from '@courier/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Consignment } from './consignment.entity';

@Entity('consignment_charges')
export class ConsignmentCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  consignmentId: string;

  @ManyToOne(() => Consignment, (c) => c.charges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consignmentId' })
  consignment: Consignment;

  @Column({ type: 'enum', enum: ChargeType })
  type: ChargeType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
