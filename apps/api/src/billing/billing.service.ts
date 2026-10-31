import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InvoiceStatus, Role } from '@courier/shared';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginateMeta, PaginationDto } from '../common/dto/pagination.dto';
import { Consignment } from '../entities/consignment.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice) private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
    @InjectRepository(Consignment)
    private readonly consignmentsRepo: Repository<Consignment>,
  ) {}

  private async nextInvoiceNumber() {
    const count = await this.invoicesRepo.count();
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreateInvoiceDto, user: AuthUser) {
    const customer = await this.customersRepo.findOne({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const consignments = await this.consignmentsRepo.find({
      where: { id: In(dto.consignmentIds) },
      relations: ['charges'],
    });
    if (consignments.length !== dto.consignmentIds.length) {
      throw new BadRequestException('One or more consignments not found');
    }

    if (user.role === Role.BRANCH_MANAGER) {
      const invalid = consignments.some(
        (c) => c.originBranchId !== user.branchId,
      );
      if (invalid) {
        throw new BadRequestException('Consignments outside your branch');
      }
    }

    const total = consignments.reduce((sum, c) => {
      const charges = (c.charges ?? []).reduce(
        (s, ch) => s + Number(ch.amount),
        0,
      );
      return sum + charges;
    }, 0);

    const invoice = this.invoicesRepo.create({
      invoiceNumber: await this.nextInvoiceNumber(),
      customerId: dto.customerId,
      status: InvoiceStatus.ISSUED,
      totalAmount: String(total.toFixed(2)),
      consignmentIds: dto.consignmentIds,
      notes: dto.notes ?? null,
      createdById: user.id,
    });

    return this.invoicesRepo.save(invoice);
  }

  async findAll(query: PaginationDto, user: AuthUser) {
    const where =
      user.role === Role.BRANCH_MANAGER ? { createdById: user.id } : {};

    const [items, total] = await this.invoicesRepo.findAndCount({
      where,
      relations: ['customer'],
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      data: items,
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string) {
    const invoice = await this.invoicesRepo.findOne({
      where: { id },
      relations: ['customer', 'createdBy'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async customerStatement(customerId: string) {
    const customer = await this.customersRepo.findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const invoices = await this.invoicesRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    const totalIssued = invoices.reduce(
      (s, i) => s + Number(i.totalAmount),
      0,
    );
    return { customer, invoices, totalIssued };
  }
}
