import { ConsignmentStatus } from '@courier/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Consignment } from './consignment.entity';
import { User } from './user.entity';

@Entity('tracking_events')
export class TrackingEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  consignmentId: string;

  @ManyToOne(() => Consignment, (c) => c.trackingEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consignmentId' })
  consignment: Consignment;

  @Column({ type: 'enum', enum: ConsignmentStatus })
  status: ConsignmentStatus;

  @Column({ type: 'varchar', nullable: true })
  locationLabel: string | null;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
