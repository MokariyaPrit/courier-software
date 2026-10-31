import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  RateColumnDef,
  RateSectionDef,
} from '../quotations/rate-matrix.types';
import { QuotationRateRow } from './quotation-rate-row.entity';
import { User } from './user.entity';

@Entity('quotation_rate_templates')
export class QuotationRateTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Editable zone / destination columns for the rate matrix */
  @Column({ type: 'jsonb', default: [] })
  columns: RateColumnDef[];

  /** Editable service sections (DOX, PARCEL, custom, …) */
  @Column({ type: 'jsonb', default: [] })
  sections: RateSectionDef[];

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @OneToMany(() => QuotationRateRow, (row) => row.template, {
    cascade: true,
  })
  rows: QuotationRateRow[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
