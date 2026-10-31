import { QuotationStatus } from '@courier/shared';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  RateColumnDef,
  RateRowData,
  RateSectionDef,
} from '../quotations/rate-matrix.types';
import { Customer } from './customer.entity';
import { QuotationRateTemplate } from './quotation-rate-template.entity';
import { User } from './user.entity';

export type QuotationSnapshot = {
  fuelChargesExtraPercent: string;
  fovPercent: string;
  customerName: string;
  customerAddress: string | null;
  customerCity: string | null;
  customerState: string | null;
  customerPincode: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  columns: RateColumnDef[];
  sections: RateSectionDef[];
  rows: RateRowData[];
};

@Entity('quotations')
export class Quotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  quotationCode: string | null;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

  @ManyToOne(() => QuotationRateTemplate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'templateId' })
  template: QuotationRateTemplate | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'date' })
  quotationDate: string;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    default: QuotationStatus.DRAFT,
  })
  status: QuotationStatus;

  @Column({ type: 'jsonb', nullable: true })
  snapshot: QuotationSnapshot | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
