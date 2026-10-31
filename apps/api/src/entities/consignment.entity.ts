import { ConsignmentStatus, ServiceType } from '@courier/shared';
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
import { Customer } from './customer.entity';
import { User } from './user.entity';
import { ConsignmentCharge } from './consignment-charge.entity';
import { TrackingEvent } from './tracking-event.entity';

@Entity('consignments')
export class Consignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  awb: string;

  @Column({
    type: 'enum',
    enum: ConsignmentStatus,
    default: ConsignmentStatus.BOOKED,
  })
  status: ConsignmentStatus;

  @Column({
    type: 'enum',
    enum: ServiceType,
    default: ServiceType.STANDARD,
  })
  serviceType: ServiceType;

  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer | null;

  @Column({ type: 'varchar' })
  senderName: string;

  @Column({ type: 'varchar', nullable: true })
  senderPhone: string | null;

  @Column({ type: 'text', nullable: true })
  senderAddress: string | null;

  @Column({ type: 'varchar' })
  receiverName: string;

  @Column({ type: 'varchar', nullable: true })
  receiverPhone: string | null;

  @Column({ type: 'text', nullable: true })
  receiverAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  receiverCity: string | null;

  @Column({ type: 'varchar', nullable: true })
  receiverPincode: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  weightKg: string;

  @Column({ type: 'int', default: 1 })
  pieces: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  codAmount: string;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @OneToMany(() => ConsignmentCharge, (charge) => charge.consignment, {
    cascade: true,
  })
  charges: ConsignmentCharge[];

  @OneToMany(() => TrackingEvent, (event) => event.consignment, {
    cascade: true,
  })
  trackingEvents: TrackingEvent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
