import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ChargeType,
  ConsignmentStatus,
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

  private async nextAwb() {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await this.consignmentsRepo.count();
    const seq = String(count + 1).padStart(7, '0');
    return `CN${year}${seq}`;
  }

  async create(dto: CreateConsignmentDto, user: AuthUser) {
    const awb = await this.nextAwb();
    const consignment = this.consignmentsRepo.create({
      awb,
      status: ConsignmentStatus.BOOKED,
      serviceType: dto.serviceType ?? ServiceType.STANDARD,
      customerId: dto.customerId ?? null,
      senderName: dto.senderName,
      senderPhone: dto.senderPhone ?? null,
      senderAddress: dto.senderAddress ?? null,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone ?? null,
      receiverAddress: dto.receiverAddress ?? null,
      receiverCity: dto.receiverCity ?? null,
      receiverPincode: dto.receiverPincode ?? null,
      weightKg: String(dto.weightKg ?? 0),
      pieces: dto.pieces ?? 1,
      codAmount: String(dto.codAmount ?? 0),
      createdById: user.id,
      remarks: dto.remarks ?? null,
    });

    const saved = await this.consignmentsRepo.save(consignment);

    const chargeInputs =
      dto.charges?.length
        ? dto.charges
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

  async findAll(query: ConsignmentQueryDto) {
    const { sortBy, sortOrder } = resolveSortPair(query, CONSIGNMENT_SORT, {
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
    const qb = this.consignmentsRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.customer', 'customer')
      .leftJoinAndSelect('c.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .orderBy(`c.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(c.awb ILIKE :q OR c.receiverName ILIKE :q OR c.receiverPhone ILIKE :q)',
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
      relations: [
        'customer',
        'charges',
        'trackingEvents',
        'trackingEvents.createdBy',
        'trackingEvents.createdBy.userInfo',
        'createdBy',
        'createdBy.userInfo',
      ],
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
    const qb = this.consignmentsRepo.createQueryBuilder('c');
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
