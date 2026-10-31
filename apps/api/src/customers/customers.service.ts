import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  paginateMeta,
  PaginationDto,
  resolveOrder,
} from '../common/dto/pagination.dto';
import { Customer } from '../entities/customer.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

const CUSTOMER_SORT = ['name', 'city', 'phone', 'createdAt'] as const;

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
  ) {}

  create(dto: CreateCustomerDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async findAll(query: PaginationDto & { search?: string }) {
    const where = query.search
      ? [{ name: ILike(`%${query.search}%`) }, { phone: ILike(`%${query.search}%`) }]
      : undefined;
    const [items, total] = await this.repo.findAndCount({
      where,
      order: resolveOrder(query, CUSTOMER_SORT, {
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      data: items,
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string) {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const customer = await this.findOne(id);
    Object.assign(customer, dto);
    return this.repo.save(customer);
  }
}
