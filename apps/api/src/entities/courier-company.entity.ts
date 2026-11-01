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

@Entity('courier_companies')
export class CourierCompany {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Website / portal / tracking link */
  @Column({ type: 'varchar', nullable: true, length: 500 })
  companyLink: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Admin-created companies are shared with every user (read-only for
   * non-admins). User-created companies stay private to that user.
   * Default true so existing catalog rows remain visible after the column is added.
   */
  @Column({ type: 'boolean', default: true })
  isShared: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
