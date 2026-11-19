import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Consignment } from './consignment.entity';
import { Invoice } from './invoice.entity';

@Entity('invoice_consignments')
@Unique(['invoiceId', 'consignmentId'])
@Index(['consignmentId'])
export class InvoiceConsignment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.invoiceConsignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ type: 'bigint' })
  consignmentId: string;

  @ManyToOne(() => Consignment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'consignmentId' })
  consignment: Consignment;

  /** Display / billing order within the invoice */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
