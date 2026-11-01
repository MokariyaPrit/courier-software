import {
  BadRequestException,
  ForbiddenException,
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
  UpdateConsignmentDto,
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

  async create(dto: CreateConsignmentDto, user: AuthUser) {
    const bookingType = dto.bookingType ?? BookingType.CASH;

    if (bookingType === BookingType.ACCOUNT && !dto.customerId) {
      throw new BadRequestException('Customer is required for account booking');
    }
    if (bookingType === BookingType.CASH && !dto.partyName?.trim()) {
      throw new BadRequestException('Party name is required for cash booking');
    }

    const awb = dto.awb.trim();
    if (!awb) {
      throw new BadRequestException('Document number is required');
    }

    const consignment = this.consignmentsRepo.create({
      awb,
      status: ConsignmentStatus.BOOKED,
      bookingType,
      serviceType: dto.serviceType ?? ServiceType.STANDARD,
      customerId:
        bookingType === BookingType.ACCOUNT ? (dto.customerId ?? null) : null,
      courierCompanyId: dto.courierCompanyId ?? null,
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
      .leftJoinAndSelect('c.courierCompany', 'courierCompany')
      .leftJoinAndSelect('c.receiver', 'receiver')
      .leftJoinAndSelect('c.senderLocation', 'senderLocation')
      .leftJoinAndSelect('c.charges', 'charges')
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
    if (query.customerId) {
      qb.andWhere('c.customerId = :customerId', {
        customerId: query.customerId,
      });
    }
    if (query.partyName?.trim()) {
      qb.andWhere('c.partyName ILIKE :partyName', {
        partyName: `%${query.partyName.trim()}%`,
      });
    }
    if (query.dateFrom?.trim()) {
      qb.andWhere(
        'COALESCE(c.bookingDate, CAST(c.createdAt AS date)) >= :dateFrom',
        { dateFrom: query.dateFrom.trim() },
      );
    }
    if (query.dateTo?.trim()) {
      qb.andWhere(
        'COALESCE(c.bookingDate, CAST(c.createdAt AS date)) <= :dateTo',
        { dateTo: query.dateTo.trim() },
      );
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
        '(c.awb ILIKE :q OR c.receiverName ILIKE :q OR c.receiverPhone ILIKE :q OR c.partyName ILIKE :q OR customer.name ILIKE :q)',
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
        courierCompany: true,
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

  private assertOwner(consignment: Consignment, user: AuthUser) {
    if (user.role !== Role.ADMIN && consignment.createdById !== user.id) {
      throw new ForbiddenException('You can only manage your own bookings');
    }
  }

  private async replaceCharges(
    consignmentId: string,
    dto: {
      charges?: CreateConsignmentDto['charges'];
      cgst?: number;
      sgst?: number;
      igst?: number;
      freightAmount?: number;
    },
  ) {
    await this.chargesRepo.softDelete({ consignmentId });

    const chargeInputs =
      dto.charges?.length
        ? [...dto.charges]
        : [
            {
              type: ChargeType.FREIGHT,
              amount: dto.freightAmount ?? 0,
              description: 'Freight',
            },
          ];

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

    if (chargeInputs.length) {
      await this.chargesRepo.save(
        chargeInputs.map((c) =>
          this.chargesRepo.create({
            consignmentId,
            type: c.type,
            amount: String(c.amount),
            description: c.description ?? null,
          }),
        ),
      );
    }
  }

  async update(id: string, dto: UpdateConsignmentDto, user: AuthUser) {
    const consignment = await this.findOne(id);
    this.assertOwner(consignment, user);

    if (dto.bookingDate !== undefined) {
      consignment.bookingDate = dto.bookingDate || this.todayIsoDate();
    }
    if (dto.awb !== undefined) {
      const awb = dto.awb.trim();
      if (!awb) {
        throw new BadRequestException('Document number is required');
      }
      consignment.awb = awb;
    }
    if (dto.customerId !== undefined) consignment.customerId = dto.customerId;
    if (dto.courierCompanyId !== undefined) {
      consignment.courierCompanyId = dto.courierCompanyId;
    }
    if (dto.quotationId !== undefined) {
      consignment.quotationId = dto.quotationId;
    }
    if (dto.senderLocationId !== undefined) {
      consignment.senderLocationId = dto.senderLocationId;
    }
    if (dto.receiverId !== undefined) consignment.receiverId = dto.receiverId;
    if (dto.rateSectionId !== undefined) {
      consignment.rateSectionId = dto.rateSectionId;
    }
    if (dto.rateColumnId !== undefined) {
      consignment.rateColumnId = dto.rateColumnId;
    }

    if (consignment.bookingType === BookingType.CASH) {
      if (dto.partyName !== undefined) {
        const name = dto.partyName?.trim() || '';
        if (!name) {
          throw new BadRequestException('Party name is required for cash booking');
        }
        consignment.partyName = name;
      }
      if (dto.partyPhone !== undefined) {
        consignment.partyPhone = dto.partyPhone;
      }
      if (dto.partyAddress !== undefined) {
        consignment.partyAddress = dto.partyAddress;
      }
      if (dto.partyCity !== undefined) consignment.partyCity = dto.partyCity;
      if (dto.partyState !== undefined) consignment.partyState = dto.partyState;
      if (dto.partyPincode !== undefined) {
        consignment.partyPincode = dto.partyPincode;
      }
      if (dto.partyGstin !== undefined) consignment.partyGstin = dto.partyGstin;
      if (dto.partyEmail !== undefined) consignment.partyEmail = dto.partyEmail;
    }

    if (dto.senderName !== undefined) consignment.senderName = dto.senderName;
    if (dto.senderPhone !== undefined) consignment.senderPhone = dto.senderPhone;
    if (dto.senderAddress !== undefined) {
      consignment.senderAddress = dto.senderAddress;
    }
    if (dto.receiverName !== undefined) {
      consignment.receiverName = dto.receiverName;
    }
    if (dto.receiverPhone !== undefined) {
      consignment.receiverPhone = dto.receiverPhone;
    }
    if (dto.receiverAddress !== undefined) {
      consignment.receiverAddress = dto.receiverAddress;
    }
    if (dto.receiverCity !== undefined) {
      consignment.receiverCity = dto.receiverCity;
    }
    if (dto.receiverState !== undefined) {
      consignment.receiverState = dto.receiverState;
    }
    if (dto.receiverPincode !== undefined) {
      consignment.receiverPincode = dto.receiverPincode;
    }
    if (dto.receiverCityId !== undefined) {
      consignment.receiverCityId = dto.receiverCityId;
    }
    if (dto.receiverStateId !== undefined) {
      consignment.receiverStateId = dto.receiverStateId;
    }
    if (dto.weightKg !== undefined) {
      consignment.weightKg = String(dto.weightKg);
    }
    if (dto.cgst !== undefined) consignment.cgst = String(dto.cgst);
    if (dto.sgst !== undefined) consignment.sgst = String(dto.sgst);
    if (dto.igst !== undefined) consignment.igst = String(dto.igst);
    if (dto.remarks !== undefined) {
      consignment.remarks = dto.remarks?.trim() || null;
    }

    await this.consignmentsRepo.save(consignment);

    if (
      dto.charges !== undefined ||
      dto.cgst !== undefined ||
      dto.sgst !== undefined ||
      dto.igst !== undefined
    ) {
      const freightFromCharges = dto.charges?.find(
        (c) => c.type === ChargeType.FREIGHT,
      )?.amount;
      await this.replaceCharges(id, {
        charges: dto.charges,
        cgst: dto.cgst !== undefined ? dto.cgst : Number(consignment.cgst),
        sgst: dto.sgst !== undefined ? dto.sgst : Number(consignment.sgst),
        igst: dto.igst !== undefined ? dto.igst : Number(consignment.igst),
        freightAmount: freightFromCharges,
      });
    }

    return this.findOne(id);
  }

  async remove(id: string, user: AuthUser) {
    const consignment = await this.findOne(id);
    this.assertOwner(consignment, user);
    await this.chargesRepo.softDelete({ consignmentId: id });
    await this.consignmentsRepo.softDelete(id);
    return { deleted: true };
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
