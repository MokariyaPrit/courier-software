import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomerPayment } from './customer-payment.entity';
import { Invoice } from './invoice.entity';

@Entity('payment_allocations')
export class PaymentAllocation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  paymentId: string;

  @ManyToOne(() => CustomerPayment, (p) => p.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'paymentId' })
  payment: CustomerPayment;

  @Column({ type: 'bigint' })
  invoiceId: string;

  @ManyToOne(() => Invoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @CreateDateColumn()
  createdAt: Date;
}
