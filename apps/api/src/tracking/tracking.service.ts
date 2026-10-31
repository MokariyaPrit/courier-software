import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CONSIGNMENT_STATUS_FLOW,
  ConsignmentStatus,
  Role,
} from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Consignment } from '../entities/consignment.entity';
import { TrackingEvent } from '../entities/tracking-event.entity';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(Consignment)
    private readonly consignmentsRepo: Repository<Consignment>,
    @InjectRepository(TrackingEvent)
    private readonly eventsRepo: Repository<TrackingEvent>,
  ) {}

  async updateStatus(id: string, dto: UpdateStatusDto, user: AuthUser) {
    const consignment = await this.consignmentsRepo.findOne({ where: { id } });
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

    const allowed = CONSIGNMENT_STATUS_FLOW[consignment.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot move from ${consignment.status} to ${dto.status}`,
      );
    }

    const branchId =
      dto.branchId ??
      user.branchId ??
      consignment.currentBranchId ??
      consignment.originBranchId;

    consignment.status = dto.status;
    if (
      dto.status === ConsignmentStatus.IN_TRANSIT ||
      dto.status === ConsignmentStatus.AT_HUB ||
      dto.status === ConsignmentStatus.OUT_FOR_DELIVERY
    ) {
      consignment.currentBranchId = branchId;
    }
    if (dto.remarks) {
      consignment.remarks = dto.remarks;
    }
    await this.consignmentsRepo.save(consignment);

    const event = await this.eventsRepo.save(
      this.eventsRepo.create({
        consignmentId: consignment.id,
        status: dto.status,
        branchId,
        createdById: user.id,
        remarks: dto.remarks ?? null,
      }),
    );

    return { consignment, event };
  }

  async timeline(id: string, user: AuthUser) {
    const consignment = await this.consignmentsRepo.findOne({ where: { id } });
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
    return this.eventsRepo.find({
      where: { consignmentId: id },
      relations: ['branch', 'createdBy'],
      order: { createdAt: 'ASC' },
    });
  }

  async ofdList(user: AuthUser) {
    const qb = this.consignmentsRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.originBranch', 'originBranch')
      .where('c.status = :status', {
        status: ConsignmentStatus.OUT_FOR_DELIVERY,
      })
      .orderBy('c.updatedAt', 'DESC');

    if (user.role === Role.BRANCH_MANAGER) {
      qb.andWhere(
        '(c.originBranchId = :branchId OR c.currentBranchId = :branchId)',
        { branchId: user.branchId },
      );
    }

    return qb.getMany();
  }
}
