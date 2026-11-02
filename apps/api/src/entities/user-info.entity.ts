import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_info')
export class UserInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.userInfo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar' })
  fullName: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  state: string | null;

  @Column({ type: 'varchar', nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', nullable: true })
  companyName: string | null;

  @Column({ type: 'varchar', nullable: true })
  gstin: string | null;

  @Column({ type: 'varchar', nullable: true })
  panNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankAccountNo: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankIfsc: string | null;

  @Column({ type: 'varchar', nullable: true })
  upiId: string | null;

  /** Default billing GST rates (%) */
  @Column({ type: 'numeric', precision: 8, scale: 2, default: 9 })
  sgstPercent: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 9 })
  cgstPercent: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  igstPercent: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /**
   * Per-user booking Tab order: which fields receive focus.
   * Shape: { account: string[], cash: string[] }
   */
  @Column({ type: 'jsonb', nullable: true })
  bookingTabConfig: { account: string[]; cash: string[] } | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
