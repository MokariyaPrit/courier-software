import { InvoiceStatus } from '@courier/shared';
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
import { Customer } from './customer.entity';
import { User } from './user.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  invoiceNumber: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.ISSUED,
  })
  status: InvoiceStatus;

  /** Business bill / invoice date */
  @Column({ type: 'date', nullable: true })
  billDate: string | null;

  /** Billing period start (inclusive) */
  @Column({ type: 'date', nullable: true })
  periodStart: string | null;

  /** Billing period end (inclusive) */
  @Column({ type: 'date', nullable: true })
  periodEnd: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  grossAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  fuelSurcharge: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subTotal: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 9 })
  cgstPercent: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 9 })
  sgstPercent: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  igstPercent: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cgstAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  sgstAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  igstAmount: string;

  /** Difference to nearest rupee (can be negative) */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  roundOffAmount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: string;

  @Column({ type: 'simple-json', nullable: true })
  consignmentIds: string[] | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
