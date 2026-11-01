import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourierCompany } from './courier-company.entity';
import { User } from './user.entity';

/** Per-user visibility + default for courier companies (esp. shared admin ones). */
@Entity('user_courier_company_prefs')
@Index(['userId', 'courierCompanyId'], { unique: true })
export class UserCourierCompanyPref {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  courierCompanyId: string;

  @ManyToOne(() => CourierCompany, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courierCompanyId' })
  courierCompany: CourierCompany;

  /** Hide this (usually shared) company from my booking select. */
  @Column({ type: 'boolean', default: false })
  isHidden: boolean;

  /** Prefill this company on new bookings. Only one default per user. */
  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
