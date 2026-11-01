import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BookingType,
  ChargeType,
  ConsignmentStatus,
  Role,
  ServiceType,
} from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginateMeta, resolveSortPair } from '../common/dto/pagination.dto';
import { ConsignmentCharge } from '../entities/consignment-charge.entity';
import { Consignment } from '../entities/consignment.entity';
import { TrackingEvent } from '../entities/tracking-event.entity';
import {
  ConsignmentQueryDto,
  CreateConsignmentDto,
} from './dto/consignment.dto';

const CONSIGNMENT_SORT = [
  'awb',
  'receiverName',
  'status',
  'bookingType',
  'bookingDate',
  'createdAt',
] as const;

@Injectable()
export class ConsignmentsService {
  constructor(
    @InjectRepository(Consignment)
    private readonly consignmentsRepo: Repository<Consignment>,
    @InjectRepository(ConsignmentCharge)
    private readonly chargesRepo: Repository<ConsignmentCharge>,
    @InjectRepository(TrackingEvent)
    private readonly eventsRepo: Repository<TrackingEvent>,
  ) {}

  private todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  private async nextAwb() {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await this.consignmentsRepo.count();
    const seq = String(count + 1).padStart(7, '0');
    return `CN${year}${seq}`;
  }

  async create(dto: CreateConsignmentDto, user: AuthUser) {
    const bookingType = dto.bookingType ?? BookingType.CASH;

    if (bookingType === BookingType.ACCOUNT && !dto.customerId) {
      throw new BadRequestException('Customer is required for account booking');
    }
    if (bookingType === BookingType.CASH && !dto.partyName?.trim()) {
      throw new BadRequestException('Party name is required for cash booking');
    }

    const awb = await this.nextAwb();
    const consignment = this.consignmentsRepo.create({
      awb,
      status: ConsignmentStatus.BOOKED,
      bookingType,
      serviceType: dto.serviceType ?? ServiceType.STANDARD,
      customerId:
        bookingType === BookingType.ACCOUNT ? (dto.customerId ?? null) : null,
      quotationId: dto.quotationId ?? null,
      senderLocationId: dto.senderLocationId ?? null,
      receiverId: dto.receiverId ?? null,
      rateSectionId: dto.rateSectionId ?? null,
      rateColumnId: dto.rateColumnId ?? null,
      bookingDate: dto.bookingDate || this.todayIsoDate(),
      partyName:
        bookingType === BookingType.CASH
          ? dto.partyName?.trim() || null
          : null,
      partyPhone:
        bookingType === BookingType.CASH ? dto.partyPhone ?? null : null,
      partyAddress:
        bookingType === BookingType.CASH ? dto.partyAddress ?? null : null,
      partyCity:
        bookingType === BookingType.CASH ? dto.partyCity ?? null : null,
      partyState:
        bookingType === BookingType.CASH ? dto.partyState ?? null : null,
      partyPincode:
        bookingType === BookingType.CASH ? dto.partyPincode ?? null : null,
      partyGstin:
        bookingType === BookingType.CASH ? dto.partyGstin ?? null : null,
      partyEmail:
        bookingType === BookingType.CASH ? dto.partyEmail ?? null : null,
      senderName: dto.senderName,
      senderPhone: dto.senderPhone ?? null,
      senderAddress: dto.senderAddress ?? null,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone ?? null,
      receiverAddress: dto.receiverAddress ?? null,
      receiverCity: dto.receiverCity ?? null,
      receiverState: dto.receiverState ?? null,
      receiverPincode: dto.receiverPincode ?? null,
      receiverCityId: dto.receiverCityId ?? null,
      receiverStateId: dto.receiverStateId ?? null,
      weightKg: String(dto.weightKg ?? 0),
      pieces: dto.pieces ?? 1,
      codAmount: String(dto.codAmount ?? 0),
      cgst: String(dto.cgst ?? 0),
      sgst: String(dto.sgst ?? 0),
      igst: String(dto.igst ?? 0),
      createdById: user.id,
      remarks: dto.remarks ?? null,
    });

    const saved = await this.consignmentsRepo.save(consignment);

    const chargeInputs =
      dto.charges?.length
        ? [...dto.charges]
        : [
            {
              type: ChargeType.FREIGHT,
              amount: 0,
              description: 'Freight',
            },
          ];

    if ((dto.codAmount ?? 0) > 0) {
      chargeInputs.push({
        type: ChargeType.COD,
        amount: dto.codAmount ?? 0,
        description: 'COD amount',
      });
    }

    const taxCharges: Array<{
      type: ChargeType;
      amount: number;
      description: string;
    }> = [
      {
        type: ChargeType.CGST,
        amount: Number(dto.cgst ?? 0),
        description: 'CGST',
      },
      {
        type: ChargeType.SGST,
        amount: Number(dto.sgst ?? 0),
        description: 'SGST',
      },
      {
        type: ChargeType.IGST,
        amount: Number(dto.igst ?? 0),
        description: 'IGST',
      },
    ];
    for (const tax of taxCharges) {
      if (tax.amount <= 0) continue;
      if (chargeInputs.some((c) => c.type === tax.type)) continue;
      chargeInputs.push(tax);
    }

    await this.chargesRepo.save(
      chargeInputs.map((c) =>
        this.chargesRepo.create({
          consignmentId: saved.id,
          type: c.type,
          amount: String(c.amount),
          description: c.description ?? null,
        }),
      ),
    );

    await this.eventsRepo.save(
      this.eventsRepo.create({
        consignmentId: saved.id,
        status: ConsignmentStatus.BOOKED,
        locationLabel: null,
        createdById: user.id,
        remarks: 'Consignment booked',
      }),
    );

    return this.findOne(saved.id);
  }

  async findAll(query: ConsignmentQueryDto, user?: AuthUser) {
    const { sortBy, sortOrder } = resolveSortPair(query, CONSIGNMENT_SORT, {
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
    const qb = this.consignmentsRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.customer', 'customer')
      .leftJoinAndSelect('c.receiver', 'receiver')
      .leftJoinAndSelect('c.senderLocation', 'senderLocation')
      .leftJoinAndSelect('c.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .where('c.deletedAt IS NULL')
      .orderBy(`c.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.bookingType) {
      qb.andWhere('c.bookingType = :bookingType', {
        bookingType: query.bookingType,
      });
    }
    if (query.receiverId) {
      qb.andWhere('c.receiverId = :receiverId', {
        receiverId: query.receiverId,
      });
    }

    const mine =
      query.mine === true ||
      (user && user.role !== Role.ADMIN && query.mine !== false);
    if (mine && user) {
      qb.andWhere('c.createdById = :uid', { uid: user.id });
    } else if (user && user.role !== Role.ADMIN) {
      qb.andWhere('c.createdById = :uid', { uid: user.id });
    }

    if (query.search) {
      qb.andWhere(
        '(c.awb ILIKE :q OR c.receiverName ILIKE :q OR c.receiverPhone ILIKE :q OR c.partyName ILIKE :q)',
        { q: `%${query.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      data: items.map((item) => {
        if (item.createdBy) {
          delete (item.createdBy as { passwordHash?: string }).passwordHash;
        }
        return item;
      }),
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string) {
    const consignment = await this.consignmentsRepo.findOne({
      where: { id },
      relations: {
        customer: true,
        receiver: true,
        senderLocation: true,
        quotation: true,
        charges: true,
        trackingEvents: {
          createdBy: {
            userInfo: true,
          },
        },
        createdBy: {
          userInfo: true,
        },
      },
    });
    if (!consignment) {
      throw new NotFoundException('Consignment not found');
    }
    if (consignment.trackingEvents?.length) {
      consignment.trackingEvents.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      for (const event of consignment.trackingEvents) {
        if (event.createdBy) {
          delete (event.createdBy as { passwordHash?: string }).passwordHash;
        }
      }
    }
    if (consignment.createdBy) {
      delete (consignment.createdBy as { passwordHash?: string }).passwordHash;
    }
    return consignment;
  }

  async findByAwb(awb: string) {
    const consignment = await this.consignmentsRepo.findOne({
      where: { awb },
    });
    if (!consignment) {
      throw new NotFoundException('Consignment not found');
    }
    return this.findOne(consignment.id);
  }

  async dashboardCounts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const qb = this.consignmentsRepo
      .createQueryBuilder('c')
      .where('c.deletedAt IS NULL');
    const total = await qb.getCount();
    const bookedToday = await qb
      .clone()
      .andWhere('c.createdAt >= :today', { today })
      .getCount();
    const inTransit = await qb
      .clone()
      .andWhere('c.status = :s', { s: ConsignmentStatus.IN_TRANSIT })
      .getCount();
    const ofd = await qb
      .clone()
      .andWhere('c.status = :s', { s: ConsignmentStatus.OUT_FOR_DELIVERY })
      .getCount();
    const delivered = await qb
      .clone()
      .andWhere('c.status = :s', { s: ConsignmentStatus.DELIVERED })
      .getCount();
    return { total, bookedToday, inTransit, ofd, delivered };
  }
}
