import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CONSIGNMENT_STATUS_FLOW,
  ConsignmentStatus,
} from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  paginateMeta,
  PaginationDto,
  resolveOrder,
} from '../common/dto/pagination.dto';
import { Consignment } from '../entities/consignment.entity';
import { TrackingEvent } from '../entities/tracking-event.entity';
import { UpdateStatusDto } from './dto/update-status.dto';

const OFD_SORT = ['awb', 'receiverName', 'updatedAt', 'createdAt'] as const;

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

    const allowed = CONSIGNMENT_STATUS_FLOW[consignment.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot move from ${consignment.status} to ${dto.status}`,
      );
    }

    consignment.status = dto.status;
    if (dto.remarks) {
      consignment.remarks = dto.remarks;
    }
    await this.consignmentsRepo.save(consignment);

    const event = await this.eventsRepo.save(
      this.eventsRepo.create({
        consignmentId: consignment.id,
        status: dto.status,
        locationLabel: dto.locationLabel ?? null,
        createdById: user.id,
        remarks: dto.remarks ?? null,
      }),
    );

    return { consignment, event };
  }

  async timeline(id: string) {
    const consignment = await this.consignmentsRepo.findOne({ where: { id } });
    if (!consignment) {
      throw new NotFoundException('Consignment not found');
    }
    const events = await this.eventsRepo.find({
      where: { consignmentId: id },
      relations: ['createdBy', 'createdBy.userInfo'],
      order: { createdAt: 'ASC' },
    });
    return events.map((event) => {
      if (event.createdBy) {
        delete (event.createdBy as { passwordHash?: string }).passwordHash;
      }
      return event;
    });
  }

  async ofdList(query: PaginationDto) {
    const [items, total] = await this.consignmentsRepo.findAndCount({
      where: { status: ConsignmentStatus.OUT_FOR_DELIVERY },
      order: resolveOrder(query, OFD_SORT, {
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      }),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      data: items,
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }
}
