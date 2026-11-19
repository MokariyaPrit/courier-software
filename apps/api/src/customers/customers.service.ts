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
import { Customer } from '../entities/customer.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

const CUSTOMER_SORT = [
  'name',
  'primaryPhone',
  'primaryEmail',
  'createdAt',
] as const;

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
  ) {}

  private emptyToNull(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  /** Expose city/state names for API clients (resolved from FKs). */
  private sanitize(customer: Customer) {
    if (customer.createdBy) {
      delete (customer.createdBy as { passwordHash?: string }).passwordHash;
    }
    const { cityRef, stateRef, ...rest } = customer;
    return {
      ...rest,
      city: cityRef?.name ?? null,
      state: stateRef?.name ?? null,
    };
  }

  private locationRelations() {
    return {
      cityRef: true,
      stateRef: true,
      createdBy: {
        userInfo: true,
      },
    } as const;
  }

  async create(dto: CreateCustomerDto, user: AuthUser) {
    const customer = await this.repo.save(
      this.repo.create({
        name: dto.name.trim(),
        primaryPhone: this.emptyToNull(dto.primaryPhone) ?? null,
        secondaryPhone: this.emptyToNull(dto.secondaryPhone) ?? null,
        primaryEmail: this.emptyToNull(dto.primaryEmail)?.toLowerCase() ?? null,
        secondaryEmail:
          this.emptyToNull(dto.secondaryEmail)?.toLowerCase() ?? null,
        address: this.emptyToNull(dto.address) ?? null,
        cityId: dto.cityId ?? null,
        stateId: dto.stateId ?? null,
        pincode: this.emptyToNull(dto.pincode) ?? null,
        gstin: this.emptyToNull(dto.gstin) ?? null,
        panNumber: this.emptyToNull(dto.panNumber) ?? null,
        notes: this.emptyToNull(dto.notes) ?? null,
        fuelChargesExtraPercent: String(dto.fuelChargesExtraPercent ?? 0),
        fovPercent: String(dto.fovPercent ?? 0),
        isActive: dto.isActive ?? true,
        createdById: user.id,
      }),
    );
    return this.findOne(customer.id, user);
  }

  async findAll(query: PaginationDto & { search?: string }, user: AuthUser) {
    const { sortBy, sortOrder } = resolveSortPair(query, CUSTOMER_SORT, {
      sortBy: 'name',
      sortOrder: 'ASC',
    });

    const qb = this.repo
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.cityRef', 'cityRef')
      .leftJoinAndSelect('customer.stateRef', 'stateRef')
      .leftJoinAndSelect('customer.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .where('customer.deletedAt IS NULL')
      .orderBy(`customer.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (user.role !== Role.ADMIN) {
      qb.andWhere('customer.createdById = :uid', { uid: user.id });
    }

    if (query.search) {
      qb.andWhere(
        `(customer.name ILIKE :q
          OR customer.primaryPhone ILIKE :q
          OR customer.secondaryPhone ILIKE :q
          OR customer.primaryEmail ILIKE :q
          OR customer.secondaryEmail ILIKE :q
          OR cityRef.name ILIKE :q
          OR stateRef.name ILIKE :q)`,
        { q: `%${query.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      data: items.map((c) => this.sanitize(c)),
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const customer = await this.repo.findOne({
      where: { id },
      relations: this.locationRelations(),
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    if (user.role !== Role.ADMIN && customer.createdById !== user.id) {
      throw new ForbiddenException('You can only access your own customers');
    }
    return this.sanitize(customer);
  }

  async update(id: string, dto: UpdateCustomerDto, user: AuthUser) {
    await this.findOne(id, user);
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.name !== undefined) customer.name = dto.name.trim();
    if (dto.primaryPhone !== undefined) {
      customer.primaryPhone = this.emptyToNull(dto.primaryPhone) ?? null;
    }
    if (dto.secondaryPhone !== undefined) {
      customer.secondaryPhone = this.emptyToNull(dto.secondaryPhone) ?? null;
    }
    if (dto.primaryEmail !== undefined) {
      customer.primaryEmail =
        this.emptyToNull(dto.primaryEmail)?.toLowerCase() ?? null;
    }
    if (dto.secondaryEmail !== undefined) {
      customer.secondaryEmail =
        this.emptyToNull(dto.secondaryEmail)?.toLowerCase() ?? null;
    }
    if (dto.address !== undefined) {
      customer.address = this.emptyToNull(dto.address) ?? null;
    }
    if (dto.cityId !== undefined) customer.cityId = dto.cityId;
    if (dto.stateId !== undefined) customer.stateId = dto.stateId;
    if (dto.pincode !== undefined) {
      customer.pincode = this.emptyToNull(dto.pincode) ?? null;
    }
    if (dto.gstin !== undefined) {
      customer.gstin = this.emptyToNull(dto.gstin) ?? null;
    }
    if (dto.panNumber !== undefined) {
      customer.panNumber = this.emptyToNull(dto.panNumber) ?? null;
    }
    if (dto.notes !== undefined) {
      customer.notes = this.emptyToNull(dto.notes) ?? null;
    }
    if (dto.fuelChargesExtraPercent !== undefined) {
      customer.fuelChargesExtraPercent = String(dto.fuelChargesExtraPercent);
    }
    if (dto.fovPercent !== undefined) {
      customer.fovPercent = String(dto.fovPercent);
    }
    if (dto.isActive !== undefined) customer.isActive = dto.isActive;

    await this.repo.save(customer);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.repo.softDelete(id);
    return { deleted: true };
  }
}
