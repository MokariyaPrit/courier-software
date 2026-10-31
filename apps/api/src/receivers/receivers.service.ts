import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  paginateMeta,
  PaginationDto,
  resolveSortPair,
} from '../common/dto/pagination.dto';
import { Receiver } from '../entities/receiver.entity';
import { CreateReceiverDto, UpdateReceiverDto } from './dto/receiver.dto';

const RECEIVER_SORT = ['name', 'city', 'phone', 'createdAt'] as const;

@Injectable()
export class ReceiversService {
  constructor(
    @InjectRepository(Receiver) private readonly repo: Repository<Receiver>,
  ) {}

  private emptyToNull(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private assertOwner(row: Receiver, user: AuthUser) {
    if (user.role !== Role.ADMIN && row.createdById !== user.id) {
      throw new ForbiddenException('You can only access your own receivers');
    }
  }

  async create(dto: CreateReceiverDto, user: AuthUser) {
    const saved = await this.repo.save(
      this.repo.create({
        name: dto.name.trim(),
        phone: this.emptyToNull(dto.phone) ?? null,
        email: this.emptyToNull(dto.email)?.toLowerCase() ?? null,
        address: this.emptyToNull(dto.address) ?? null,
        city: this.emptyToNull(dto.city) ?? null,
        state: this.emptyToNull(dto.state) ?? null,
        cityId: dto.cityId ?? null,
        stateId: dto.stateId ?? null,
        pincode: this.emptyToNull(dto.pincode) ?? null,
        notes: this.emptyToNull(dto.notes) ?? null,
        isActive: dto.isActive ?? true,
        createdById: user.id,
      }),
    );
    return this.findOne(saved.id, user);
  }

  /**
   * Same name (case-insensitive) for this branch manager → reuse;
   * otherwise create a new receiver.
   */
  async findOrCreate(dto: CreateReceiverDto, user: AuthUser) {
    const name = dto.name.trim();
    const existing = await this.repo
      .createQueryBuilder('receiver')
      .where('receiver.deletedAt IS NULL')
      .andWhere('receiver.createdById = :uid', { uid: user.id })
      .andWhere('LOWER(receiver.name) = LOWER(:name)', { name })
      .orderBy('receiver.createdAt', 'DESC')
      .getOne();

    if (existing) {
      if (dto.phone !== undefined) {
        existing.phone = this.emptyToNull(dto.phone) ?? existing.phone;
      }
      if (dto.address !== undefined) {
        existing.address = this.emptyToNull(dto.address) ?? existing.address;
      }
      if (dto.city !== undefined) {
        existing.city = this.emptyToNull(dto.city) ?? existing.city;
      }
      if (dto.state !== undefined) {
        existing.state = this.emptyToNull(dto.state) ?? existing.state;
      }
      if (dto.cityId !== undefined) existing.cityId = dto.cityId ?? existing.cityId;
      if (dto.stateId !== undefined) {
        existing.stateId = dto.stateId ?? existing.stateId;
      }
      if (dto.pincode !== undefined) {
        existing.pincode = this.emptyToNull(dto.pincode) ?? existing.pincode;
      }
      await this.repo.save(existing);
      return this.findOne(existing.id, user);
    }

    return this.create(dto, user);
  }

  async findAll(query: PaginationDto & { search?: string }, user: AuthUser) {
    const { sortBy, sortOrder } = resolveSortPair(query, RECEIVER_SORT, {
      sortBy: 'name',
      sortOrder: 'ASC',
    });
    const qb = this.repo
      .createQueryBuilder('receiver')
      .where('receiver.deletedAt IS NULL')
      .orderBy(`receiver.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (user.role !== Role.ADMIN) {
      qb.andWhere('receiver.createdById = :uid', { uid: user.id });
    }
    if (query.search) {
      qb.andWhere(
        `(receiver.name ILIKE :q OR receiver.phone ILIKE :q
          OR receiver.city ILIKE :q OR receiver.pincode ILIKE :q)`,
        { q: `%${query.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { data: items, meta: paginateMeta(query.page, query.pageSize, total) };
  }

  async findOne(id: string, user: AuthUser) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Receiver not found');
    this.assertOwner(row, user);
    return row;
  }

  async update(id: string, dto: UpdateReceiverDto, user: AuthUser) {
    const row = await this.findOne(id, user);
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.phone !== undefined) row.phone = this.emptyToNull(dto.phone) ?? null;
    if (dto.email !== undefined) {
      row.email = this.emptyToNull(dto.email)?.toLowerCase() ?? null;
    }
    if (dto.address !== undefined) {
      row.address = this.emptyToNull(dto.address) ?? null;
    }
    if (dto.city !== undefined) row.city = this.emptyToNull(dto.city) ?? null;
    if (dto.state !== undefined) row.state = this.emptyToNull(dto.state) ?? null;
    if (dto.cityId !== undefined) row.cityId = dto.cityId;
    if (dto.stateId !== undefined) row.stateId = dto.stateId;
    if (dto.pincode !== undefined) {
      row.pincode = this.emptyToNull(dto.pincode) ?? null;
    }
    if (dto.notes !== undefined) row.notes = this.emptyToNull(dto.notes) ?? null;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    await this.repo.save(row);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.repo.softDelete(id);
    return { deleted: true };
  }
}
