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

  async ofdList() {
    return this.consignmentsRepo.find({
      where: { status: ConsignmentStatus.OUT_FOR_DELIVERY },
      order: { updatedAt: 'DESC' },
    });
  }
}
