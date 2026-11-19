import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { City } from './city.entity';
import { State } from './state.entity';
import { User } from './user.entity';

/**
 * Cities the user wants as rate-matrix columns (independent of Centers).
 * Parent states + ROI are derived when building matrices.
 */
@Entity('user_rate_cities')
@Index(['createdById', 'cityId'], { unique: true })
export class UserRateCity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  cityId: string;

  @ManyToOne(() => City, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cityId' })
  cityRef: City;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'bigint', nullable: true })
  stateId: string | null;

  @ManyToOne(() => State, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stateId' })
  state: State | null;

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
