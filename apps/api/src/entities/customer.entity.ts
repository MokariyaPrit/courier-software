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
import { City } from './city.entity';
import { State } from './state.entity';
import { User } from './user.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn({ type: 'bigint' })
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

  /** Linked center / master city for booking sender */
  @Column({ type: 'bigint', nullable: true })
  cityId: string | null;

  @ManyToOne(() => City, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cityId' })
  cityRef: City | null;

  @Column({ type: 'bigint', nullable: true })
  stateId: string | null;

  @ManyToOne(() => State, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stateId' })
  stateRef: State | null;

  @Column({ type: 'varchar', nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', nullable: true })
  gstin: string | null;

  @Column({ type: 'varchar', nullable: true })
  panNumber: string | null;

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
  @Column({ type: 'bigint' })
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
