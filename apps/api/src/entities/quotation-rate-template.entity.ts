import { RateTemplateKind } from '@courier/shared';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
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
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({
    type: 'enum',
    enum: RateTemplateKind,
    default: RateTemplateKind.QUOTATION,
  })
  kind: RateTemplateKind;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Editable zone / destination columns for the rate matrix */
  @Column({ type: 'jsonb', default: [] })
  columns: RateColumnDef[];

  /** Editable service sections (DOX, PARCEL, custom, …) */
  @Column({ type: 'jsonb', default: [] })
  sections: RateSectionDef[];

  @Column({ type: 'bigint' })
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

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
