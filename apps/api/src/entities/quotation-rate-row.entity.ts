import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuotationRateTemplate } from './quotation-rate-template.entity';

@Entity('quotation_rate_rows')
export class QuotationRateRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  templateId: string;

  @ManyToOne(() => QuotationRateTemplate, (t) => t.rows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template: QuotationRateTemplate;

  /** Links to template.sections[].id */
  @Column({ type: 'varchar' })
  sectionId: string;

  @Column({ type: 'varchar' })
  weightLabel: string;

  @Column({ type: 'int', nullable: true })
  weightGrams: number | null;

  @Column({ type: 'boolean', default: false })
  isAdditional: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** columnId -> numeric string */
  @Column({ type: 'jsonb', default: {} })
  rates: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
