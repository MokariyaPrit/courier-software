import { PaymentMode } from '@courier/shared';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { PaymentAllocation } from './payment-allocation.entity';
import { User } from './user.entity';

@Entity('customer_payments')
export class CustomerPayment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'date' })
  paymentDate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: PaymentMode, default: PaymentMode.CASH })
  mode: PaymentMode;

  @Column({ type: 'varchar', nullable: true })
  referenceNo: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'bigint' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @OneToMany(() => PaymentAllocation, (a) => a.payment, { cascade: true })
  allocations: PaymentAllocation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
