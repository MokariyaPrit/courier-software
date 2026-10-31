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
  'city',
  'primaryPhone',
  'primaryEmail',
  'createdAt',
] as const;

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
  ) {}

  private sanitize(customer: Customer) {
    if (customer.createdBy) {
      delete (customer.createdBy as { passwordHash?: string }).passwordHash;
    }
    return customer;
  }

  private emptyToNull(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
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
        city: this.emptyToNull(dto.city) ?? null,
        state: this.emptyToNull(dto.state) ?? null,
        pincode: this.emptyToNull(dto.pincode) ?? null,
        gstin: this.emptyToNull(dto.gstin) ?? null,
        notes: this.emptyToNull(dto.notes) ?? null,
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
      .leftJoinAndSelect('customer.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .orderBy(`customer.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    // Branch managers only see their own customers; Admin sees all
    if (user.role !== Role.ADMIN) {
      qb.andWhere('customer.createdById = :uid', { uid: user.id });
    }

    if (query.search) {
      qb.andWhere(
        `(customer.name ILIKE :q
          OR customer.primaryPhone ILIKE :q
          OR customer.secondaryPhone ILIKE :q
          OR customer.primaryEmail ILIKE :q
          OR customer.secondaryEmail ILIKE :q)`,
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
      relations: ['createdBy', 'createdBy.userInfo'],
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
    const customer = await this.findOne(id, user);

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
    if (dto.city !== undefined) customer.city = this.emptyToNull(dto.city) ?? null;
    if (dto.state !== undefined) {
      customer.state = this.emptyToNull(dto.state) ?? null;
    }
    if (dto.pincode !== undefined) {
      customer.pincode = this.emptyToNull(dto.pincode) ?? null;
    }
    if (dto.gstin !== undefined) {
      customer.gstin = this.emptyToNull(dto.gstin) ?? null;
    }
    if (dto.notes !== undefined) {
      customer.notes = this.emptyToNull(dto.notes) ?? null;
    }
    if (dto.isActive !== undefined) customer.isActive = dto.isActive;

    await this.repo.save(customer);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
