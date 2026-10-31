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

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  primaryPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  secondaryPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  primaryEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  secondaryEmail: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  state: string | null;

  /** Linked center / master city for booking sender */
  @Column({ type: 'uuid', nullable: true })
  cityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  stateId: string | null;

  @Column({ type: 'varchar', nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', nullable: true })
  gstin: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Fuel charges extra % shown on quotation terms (e.g. 0.00) */
  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  fuelChargesExtraPercent: string;

  /** F.O.V. / EOV % per thousand on quotation terms */
  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  fovPercent: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Owning user — customer is user-wise */
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
