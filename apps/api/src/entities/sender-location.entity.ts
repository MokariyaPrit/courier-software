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

/** User-selected service center city (chip selection). */
@Entity('sender_locations')
@Index(['createdById', 'cityId'], { unique: true })
export class SenderLocation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  cityId: string;

  @ManyToOne(() => City, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cityId' })
  cityRef: City;

  /** Denormalized for quick labels */
  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'bigint', nullable: true })
  stateId: string | null;

  @ManyToOne(() => State, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stateId' })
  state: State | null;

  /** Rate matrix column id: city:{cityId} */
  @Column({ type: 'varchar' })
  rateColumnId: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

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
