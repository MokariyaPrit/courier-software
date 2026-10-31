import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ChargeType,
  ConsignmentStatus,
  Role,
  ServiceType,
} from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginateMeta } from '../common/dto/pagination.dto';
import { Branch } from '../entities/branch.entity';
import { ConsignmentCharge } from '../entities/consignment-charge.entity';
import { Consignment } from '../entities/consignment.entity';
import { TrackingEvent } from '../entities/tracking-event.entity';
import {
  ConsignmentQueryDto,
  CreateConsignmentDto,
} from './dto/consignment.dto';

@Injectable()
export class ConsignmentsService {
  constructor(
    @InjectRepository(Consignment)
    private readonly consignmentsRepo: Repository<Consignment>,
    @InjectRepository(ConsignmentCharge)
    private readonly chargesRepo: Repository<ConsignmentCharge>,
    @InjectRepository(TrackingEvent)
    private readonly eventsRepo: Repository<TrackingEvent>,
    @InjectRepository(Branch)
    private readonly branchesRepo: Repository<Branch>,
  ) {}

  private async nextAwb() {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await this.consignmentsRepo.count();
    const seq = String(count + 1).padStart(7, '0');
    return `CN${year}${seq}`;
  }

  private assertBranchAccess(user: AuthUser, branchId: string) {
    if (user.role === Role.ADMIN) return;
    if (user.branchId !== branchId) {
      throw new ForbiddenException('Outside your branch scope');
    }
  }

  async create(dto: CreateConsignmentDto, user: AuthUser) {
    const originBranchId =
      user.role === Role.BRANCH_MANAGER
        ? user.branchId
        : dto.originBranchId ?? user.branchId;

    if (!originBranchId) {
      throw new BadRequestException('originBranchId is required');
    }
    this.assertBranchAccess(user, originBranchId);

    const branch = await this.branchesRepo.findOne({
      where: { id: originBranchId },
    });
    if (!branch) {
      throw new BadRequestException('Origin branch not found');
    }

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
      originBranchId,
      currentBranchId: originBranchId,
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

    const charges = chargeInputs.map((c) =>
      this.chargesRepo.create({
        consignmentId: saved.id,
        type: c.type,
        amount: String(c.amount),
        description: c.description ?? null,
      }),
    );
    await this.chargesRepo.save(charges);

    await this.eventsRepo.save(
      this.eventsRepo.create({
        consignmentId: saved.id,
        status: ConsignmentStatus.BOOKED,
        branchId: originBranchId,
        createdById: user.id,
        remarks: 'Consignment booked',
      }),
    );

    return this.findOne(saved.id, user);
  }

  async findAll(query: ConsignmentQueryDto, user: AuthUser) {
    const qb = this.consignmentsRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.originBranch', 'originBranch')
      .leftJoinAndSelect('c.customer', 'customer')
      .orderBy('c.createdAt', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (user.role === Role.BRANCH_MANAGER) {
      qb.andWhere('c.originBranchId = :branchId', {
        branchId: user.branchId,
      });
    }

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
      data: items,
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const consignment = await this.consignmentsRepo.findOne({
      where: { id },
      relations: [
        'originBranch',
        'currentBranch',
        'customer',
        'charges',
        'trackingEvents',
        'trackingEvents.branch',
        'trackingEvents.createdBy',
        'createdBy',
      ],
    });
    if (!consignment) {
      throw new NotFoundException('Consignment not found');
    }
    if (user.role === Role.BRANCH_MANAGER) {
      if (
        consignment.originBranchId !== user.branchId &&
        consignment.currentBranchId !== user.branchId
      ) {
        throw new ForbiddenException('Outside your branch scope');
      }
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

  async findByAwb(awb: string, user: AuthUser) {
    const consignment = await this.consignmentsRepo.findOne({
      where: { awb },
    });
    if (!consignment) {
      throw new NotFoundException('Consignment not found');
    }
    return this.findOne(consignment.id, user);
  }

  async dashboardCounts(user: AuthUser) {
    const qb = this.consignmentsRepo.createQueryBuilder('c');
    if (user.role === Role.BRANCH_MANAGER) {
      qb.where('c.originBranchId = :branchId', { branchId: user.branchId });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const base = qb.clone();
    const total = await base.getCount();
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
