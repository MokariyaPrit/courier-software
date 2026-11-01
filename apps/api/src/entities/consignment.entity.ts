import {
  BookingType,
  ConsignmentStatus,
  ServiceType,
} from '@courier/shared';
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
import { Customer } from './customer.entity';
import { Quotation } from './quotation.entity';
import { Receiver } from './receiver.entity';
import { SenderLocation } from './sender-location.entity';
import { User } from './user.entity';
import { ConsignmentCharge } from './consignment-charge.entity';
import { TrackingEvent } from './tracking-event.entity';

@Entity('consignments')
export class Consignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  awb: string;

  @Column({
    type: 'enum',
    enum: ConsignmentStatus,
    default: ConsignmentStatus.BOOKED,
  })
  status: ConsignmentStatus;

  @Column({
    type: 'enum',
    enum: BookingType,
    default: BookingType.CASH,
  })
  bookingType: BookingType;

  @Column({
    type: 'enum',
    enum: ServiceType,
    default: ServiceType.STANDARD,
  })
  serviceType: ServiceType;

  /** Quotation / cash matrix section id (DOX, PARCEL, …) */
  @Column({ type: 'varchar', nullable: true })
  rateSectionId: string | null;

  /** Quotation / cash matrix column id used (city:/state:/roi) */
  @Column({ type: 'varchar', nullable: true })
  rateColumnId: string | null;

  /** Business booking date (editable; defaults to today) */
  @Column({ type: 'date', nullable: true })
  bookingDate: string | null;

  /** Cash party fields (not a Customer) */
  @Column({ type: 'varchar', nullable: true })
  partyName: string | null;

  @Column({ type: 'varchar', nullable: true })
  partyPhone: string | null;

  @Column({ type: 'text', nullable: true })
  partyAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  partyCity: string | null;

  @Column({ type: 'varchar', nullable: true })
  partyState: string | null;

  @Column({ type: 'varchar', nullable: true })
  partyPincode: string | null;

  @Column({ type: 'varchar', nullable: true })
  partyGstin: string | null;

  @Column({ type: 'varchar', nullable: true })
  partyEmail: string | null;

  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer | null;

  @Column({ type: 'uuid', nullable: true })
  quotationId: string | null;

  @ManyToOne(() => Quotation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quotationId' })
  quotation: Quotation | null;

  @Column({ type: 'uuid', nullable: true })
  senderLocationId: string | null;

  @ManyToOne(() => SenderLocation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'senderLocationId' })
  senderLocation: SenderLocation | null;

  @Column({ type: 'uuid', nullable: true })
  receiverId: string | null;

  @ManyToOne(() => Receiver, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'receiverId' })
  receiver: Receiver | null;

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
  receiverState: string | null;

  @Column({ type: 'varchar', nullable: true })
  receiverPincode: string | null;

  @Column({ type: 'uuid', nullable: true })
  receiverCityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  receiverStateId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  weightKg: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cgst: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  sgst: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  igst: string;

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

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
