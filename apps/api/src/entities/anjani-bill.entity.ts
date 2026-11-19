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
import { User } from './user.entity';

export type AnjaniBillRow = {
  id?: string;
  date: string;
  docNo: string;
  type: string;
  party: string;
  center: string;
  weight: string;
  unit: 'kg' | 'gm' | string;
  amount: string;
};

@Entity('anjani_bills')
export class AnjaniBill {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'varchar', nullable: true })
  billNo: string | null;

  @Column({ type: 'varchar', nullable: true })
  billDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  billPeriod: string | null;

  @Column({ type: 'varchar', nullable: true })
  hsn: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  address1: string | null;

  @Column({ type: 'varchar', nullable: true })
  address2: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerGst: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerPan: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', nullable: true })
  accountNo: string | null;

  @Column({ type: 'varchar', nullable: true })
  ifsc: string | null;

  @Column({ type: 'jsonb', default: [] })
  rows: AnjaniBillRow[];

  @Column({ type: 'varchar', nullable: true })
  fuel: string | null;

  @Column({ type: 'varchar', nullable: true })
  gross: string | null;

  @Column({ type: 'varchar', nullable: true })
  sub: string | null;

  @Column({ type: 'varchar', nullable: true })
  sgst: string | null;

  @Column({ type: 'varchar', nullable: true })
  cgst: string | null;

  @Column({ type: 'varchar', nullable: true })
  igst: string | null;

  @Column({ type: 'varchar', nullable: true })
  bill: string | null;

  @Column({ type: 'varchar', nullable: true })
  words: string | null;

  @Column({ type: 'varchar', nullable: true })
  headerImageKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  sourcePdfKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  sourcePdfFileName: string | null;

  @Column({ type: 'int', nullable: true })
  sourcePdfBytes: number | null;

  @Column({ type: 'varchar', nullable: true })
  editedPdfKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  editedPdfFileName: string | null;

  @Column({ type: 'jsonb', nullable: true })
  layoutJson: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
