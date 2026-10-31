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
import { State } from './state.entity';

@Entity('cities')
@Index(['stateId', 'name'], { unique: true })
export class City {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  stateId: string;

  @ManyToOne(() => State, (state) => state.cities, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stateId' })
  state: State;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
