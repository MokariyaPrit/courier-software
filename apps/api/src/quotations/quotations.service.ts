import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuotationStatus, Role } from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  paginateMeta,
  PaginationDto,
  resolveSortPair,
} from '../common/dto/pagination.dto';
import { Customer } from '../entities/customer.entity';
import { Quotation, QuotationSnapshot } from '../entities/quotation.entity';
import { QuotationRateRow } from '../entities/quotation-rate-row.entity';
import { QuotationRateTemplate } from '../entities/quotation-rate-template.entity';
import { User } from '../entities/user.entity';
import {
  CreateQuotationDto,
  IssueQuotationDto,
  UpdateQuotationDto,
} from './dto/quotation.dto';
import { RateRowDto } from './dto/quotation-template.dto';
import type {
  RateColumnDef,
  RateRowData,
  RateSectionDef,
} from './rate-matrix.types';

const QUOTATION_SORT = [
  'quotationCode',
  'quotationDate',
  'status',
  'createdAt',
] as const;

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationsRepo: Repository<Quotation>,
    @InjectRepository(Customer)
    private readonly customersRepo: Repository<Customer>,
    @InjectRepository(QuotationRateTemplate)
    private readonly templatesRepo: Repository<QuotationRateTemplate>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  private sanitize(q: Quotation) {
    if (q.createdBy) {
      delete (q.createdBy as { passwordHash?: string }).passwordHash;
    }
    return q;
  }

  private assertOwner(q: Quotation, user: AuthUser) {
    if (user.role !== Role.ADMIN && q.createdById !== user.id) {
      throw new ForbiddenException('You can only access your own quotations');
    }
  }

  private todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  private normalizeRowRates(rates: Record<string, number | string> | undefined) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(rates ?? {})) {
      out[key] = String(value ?? 0);
    }
    return out;
  }

  private rowToData(row: QuotationRateRow | RateRowDto): RateRowData {
    return {
      id: 'id' in row ? row.id : undefined,
      sectionId: row.sectionId,
      weightLabel: row.weightLabel,
      weightGrams: row.weightGrams ?? null,
      isAdditional: row.isAdditional ?? false,
      sortOrder: row.sortOrder ?? 0,
      rates: this.normalizeRowRates(row.rates),
    };
  }

  private buildSnapshot(
    customer: Customer,
    columns: RateColumnDef[],
    sections: RateSectionDef[],
    rows: RateRowData[],
  ): QuotationSnapshot {
    return {
      fuelChargesExtraPercent: String(customer.fuelChargesExtraPercent ?? 0),
      fovPercent: String(customer.fovPercent ?? 0),
      customerName: customer.name,
      customerAddress: customer.address,
      customerCity: customer.city,
      customerState: customer.state,
      customerPincode: customer.pincode,
      customerPhone: customer.primaryPhone,
      customerEmail: customer.primaryEmail,
      columns,
      sections,
      rows,
    };
  }

  private async loadCustomer(customerId: string, user: AuthUser) {
    const customer = await this.customersRepo.findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }
    if (user.role !== Role.ADMIN && customer.createdById !== user.id) {
      throw new ForbiddenException('You can only quote your own customers');
    }
    return customer;
  }

  private async loadTemplate(templateId: string, user: AuthUser) {
    const template = await this.templatesRepo.findOne({
      where: { id: templateId },
      relations: { rows: true },
    });
    if (!template) {
      throw new BadRequestException('Rate template not found');
    }
    if (user.role !== Role.ADMIN && template.createdById !== user.id) {
      throw new ForbiddenException('You can only use your own templates');
    }
    return template;
  }

  private async nextQuotationCode(userId: string) {
    const count = await this.quotationsRepo.count({
      where: { createdById: userId },
    });
    return String(count + 1).padStart(4, '0');
  }

  async create(dto: CreateQuotationDto, user: AuthUser) {
    const customer = await this.loadCustomer(dto.customerId, user);

    let columns: RateColumnDef[] = [];
    let sections: RateSectionDef[] = [];
    let rows: RateRowData[] = [];
    let templateId: string | null = dto.templateId ?? null;

    if (dto.templateId) {
      const template = await this.loadTemplate(dto.templateId, user);
      columns = [...(template.columns ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      sections = [...(template.sections ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      rows = [...(template.rows ?? [])]
        .sort(
          (a, b) =>
            a.sectionId.localeCompare(b.sectionId) ||
            a.sortOrder - b.sortOrder,
        )
        .map((r) => this.rowToData(r));
    }

    const quotation = await this.quotationsRepo.save(
      this.quotationsRepo.create({
        customerId: customer.id,
        templateId,
        createdById: user.id,
        quotationDate: dto.quotationDate ?? this.todayIsoDate(),
        status: QuotationStatus.DRAFT,
        snapshot: this.buildSnapshot(customer, columns, sections, rows),
        notes: dto.notes?.trim() || null,
        quotationCode: null,
      }),
    );

    return this.findOne(quotation.id, user);
  }

  async findAll(query: PaginationDto & { search?: string }, user: AuthUser) {
    const { sortBy, sortOrder } = resolveSortPair(query, QUOTATION_SORT, {
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    const qb = this.quotationsRepo
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.customer', 'customer')
      .leftJoinAndSelect('quotation.template', 'template')
      .leftJoinAndSelect('quotation.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .orderBy(`quotation.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (user.role !== Role.ADMIN) {
      qb.andWhere('quotation.createdById = :uid', { uid: user.id });
    }

    if (query.search) {
      qb.andWhere(
        `(quotation.quotationCode ILIKE :q
          OR customer.name ILIKE :q
          OR quotation.notes ILIKE :q)`,
        { q: `%${query.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      data: items.map((q) => this.sanitize(q)),
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const quotation = await this.quotationsRepo.findOne({
      where: { id },
      relations: {
        customer: true,
        template: true,
        createdBy: { userInfo: true },
      },
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }
    this.assertOwner(quotation, user);
    return this.sanitize(quotation);
  }

  async update(id: string, dto: UpdateQuotationDto, user: AuthUser) {
    const quotation = await this.findOne(id, user);

    if (dto.quotationDate !== undefined) {
      quotation.quotationDate = dto.quotationDate;
    }
    if (dto.notes !== undefined) {
      quotation.notes = dto.notes?.trim() || null;
    }

    if (
      dto.columns !== undefined ||
      dto.sections !== undefined ||
      dto.rows !== undefined
    ) {
      const customer = await this.loadCustomer(quotation.customerId, user);
      const prev = quotation.snapshot;
      const columns =
        dto.columns?.map((c, i) => ({
          id: c.id.trim(),
          label: c.label.trim(),
          sortOrder: c.sortOrder ?? i,
        })) ??
        prev?.columns ??
        [];
      const sections =
        dto.sections?.map((s, i) => ({
          id: s.id.trim(),
          label: s.label.trim(),
          sortOrder: s.sortOrder ?? i,
        })) ??
        prev?.sections ??
        [];
      const rows =
        dto.rows?.map((r) => this.rowToData(r)) ?? prev?.rows ?? [];
      quotation.snapshot = this.buildSnapshot(
        customer,
        columns,
        sections,
        rows,
      );
    }

    await this.quotationsRepo.save(quotation);
    return this.findOne(id, user);
  }

  async issue(id: string, dto: IssueQuotationDto, user: AuthUser) {
    const quotation = await this.findOne(id, user);

    const customer = await this.loadCustomer(quotation.customerId, user);
    const snap = quotation.snapshot;
    quotation.snapshot = this.buildSnapshot(
      customer,
      snap?.columns ?? [],
      snap?.sections ?? [],
      snap?.rows ?? [],
    );

    if (dto.quotationCode?.trim()) {
      quotation.quotationCode = dto.quotationCode.trim();
    } else if (!quotation.quotationCode) {
      quotation.quotationCode = await this.nextQuotationCode(user.id);
    }
    quotation.status = QuotationStatus.ISSUED;

    await this.quotationsRepo.save(quotation);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    const quotation = await this.findOne(id, user);
    if (quotation.status === QuotationStatus.ISSUED) {
      throw new BadRequestException('Issued quotations cannot be deleted');
    }
    await this.quotationsRepo.delete(id);
    return { deleted: true };
  }

  async document(id: string, user: AuthUser) {
    const quotation = await this.findOne(id, user);
    const issuer = await this.usersRepo.findOne({
      where: { id: quotation.createdById },
      relations: { userInfo: true },
    });
    if (issuer) {
      delete (issuer as { passwordHash?: string }).passwordHash;
    }

    const info = issuer?.userInfo;
    const snapshot = quotation.snapshot;
    const columns = [...(snapshot?.columns ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const sections = [...(snapshot?.sections ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((section) => ({
        id: section.id,
        label: section.label,
        rows: (snapshot?.rows ?? [])
          .filter((r) => r.sectionId === section.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));

    return {
      quotation: {
        id: quotation.id,
        quotationCode: quotation.quotationCode,
        quotationDate: quotation.quotationDate,
        status: quotation.status,
        notes: quotation.notes,
      },
      letterhead: {
        companyName: info?.companyName || info?.fullName || 'Courier',
        fullName: info?.fullName || issuer?.email || '',
        address: info?.address || null,
        city: info?.city || null,
        state: info?.state || null,
        pincode: info?.pincode || null,
        phone: info?.phone || null,
        email: info?.email || issuer?.email || null,
        gstin: info?.gstin || null,
      },
      customer: {
        name: snapshot?.customerName || quotation.customer?.name,
        address: snapshot?.customerAddress ?? quotation.customer?.address,
        city: snapshot?.customerCity ?? quotation.customer?.city,
        state: snapshot?.customerState ?? quotation.customer?.state,
        pincode: snapshot?.customerPincode ?? quotation.customer?.pincode,
        phone: snapshot?.customerPhone ?? quotation.customer?.primaryPhone,
        email: snapshot?.customerEmail ?? quotation.customer?.primaryEmail,
      },
      terms: {
        fovPercent: snapshot?.fovPercent ?? quotation.customer?.fovPercent ?? '0',
        fuelChargesExtraPercent:
          snapshot?.fuelChargesExtraPercent ??
          quotation.customer?.fuelChargesExtraPercent ??
          '0',
        gstPercent: '18',
        insurancePercent: '2',
      },
      columns,
      sections,
    };
  }
}
