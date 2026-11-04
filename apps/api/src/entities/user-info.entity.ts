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

  /**
   * Quotation / contract Terms & Conditions lines.
   * Supports {{placeholders}} e.g. companyName, gstPercent, fovPercent.
   * Null = use system defaults.
   */
  @Column({ type: 'jsonb', nullable: true })
  termsAndConditions: string[] | null;

  /** Optional insurance % shown in T&C (default 2) */
  @Column({ type: 'numeric', precision: 8, scale: 2, default: 2 })
  insurancePercent: string;

  /** Payment due days in T&C (default 10) */
  @Column({ type: 'int', default: 10 })
  paymentDays: number;

  /** Volumetric divisor in T&C (default 5000) */
  @Column({ type: 'int', default: 5000 })
  volumetricDivisor: number;

  /** E-way bill threshold amount in T&C (default 50000) */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 50000 })
  ewayBillThreshold: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Last calendar day the account may log in.
   * After this date (local), login is blocked. Null = no expiry.
   * Editable by Admin only; Branch Managers may view on profile.
   */
  @Column({ type: 'date', nullable: true })
  expiredOn: string | null;

  /** Outgoing SMTP — used to email quotations / invoices as this user */
  @Column({ type: 'varchar', nullable: true })
  smtpHost: string | null;

  @Column({ type: 'int', nullable: true, default: 587 })
  smtpPort: number | null;

  @Column({ type: 'boolean', default: false })
  smtpSecure: boolean;

  @Column({ type: 'varchar', nullable: true })
  smtpUser: string | null;

  /** AES-GCM ciphertext; never returned via API */
  @Column({ type: 'text', nullable: true })
  smtpPasswordEnc: string | null;

  /** Optional From address override (else smtpUser / profile email) */
  @Column({ type: 'varchar', nullable: true })
  smtpFromEmail: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
