import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
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
import { resolveTermsLines } from '../common/utils/terms-and-conditions';
import { Customer } from '../entities/customer.entity';
import { Quotation, QuotationSnapshot } from '../entities/quotation.entity';
import { QuotationRateRow } from '../entities/quotation-rate-row.entity';
import { QuotationRateTemplate } from '../entities/quotation-rate-template.entity';
import { User } from '../entities/user.entity';
import { UserInfo } from '../entities/user-info.entity';
import { DocumentMailPdfService } from '../mail/document-mail-pdf.service';
import { SendDocumentEmailDto } from '../mail/dto/send-document-email.dto';
import { MailService } from '../mail/mail.service';
import { RateColumnsService } from '../rate-columns/rate-columns.service';
import {
  CreateQuotationDto,
  IssueQuotationDto,
  UpdateQuotationDto,
} from './dto/quotation.dto';
import { RateRowDto } from './dto/quotation-template.dto';
import {
  syncMatrixToGeography,
  weightLabelForGrams,
} from './default-rate-bands';
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
    @Inject(forwardRef(() => RateColumnsService))
    private readonly rateColumns: RateColumnsService,
    private readonly mailService: MailService,
    private readonly documentMailPdf: DocumentMailPdfService,
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
    const sectionId = row.sectionId;
    const weightGrams = row.weightGrams ?? null;
    return {
      id: 'id' in row ? row.id : undefined,
      sectionId,
      weightLabel:
        weightGrams != null
          ? weightLabelForGrams(sectionId, weightGrams)
          : row.weightLabel,
      weightGrams,
      isAdditional: false,
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
      customerCity: customer.cityRef?.name ?? null,
      customerState: customer.stateRef?.name ?? null,
      customerPincode: customer.pincode,
      customerPhone: customer.primaryPhone,
      customerEmail: customer.primaryEmail,
      columns,
      sections,
      rows: rows
        .filter((r) => !r.isAdditional)
        .map((r) => ({
          ...r,
          isAdditional: false,
          weightLabel:
            r.weightGrams != null
              ? weightLabelForGrams(r.sectionId, r.weightGrams)
              : r.weightLabel,
        })),
    };
  }

  private async loadCustomer(customerId: string, user: AuthUser) {
    const customer = await this.customersRepo.findOne({
      where: { id: customerId },
      relations: { cityRef: true, stateRef: true },
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

  /**
   * Next global numeric quotation code. Counts soft-deleted rows too so we
   * never reuse a code still blocked by the unique index.
   */
  private async nextQuotationCode(_userId: string) {
    const rows = await this.quotationsRepo.find({
      select: { quotationCode: true },
      withDeleted: true,
    });
    let max = 0;
    for (const row of rows) {
      const raw = row.quotationCode?.trim();
      if (!raw) continue;
      const n = Number.parseInt(raw.replace(/\D/g, ''), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return String(max + 1).padStart(4, '0');
  }

  private async allocateQuotationCode(userId: string) {
    // Retry a few times if another request grabs the same code
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.nextQuotationCode(userId);
      const exists = await this.quotationsRepo.findOne({
        where: { quotationCode: code },
        withDeleted: true,
      });
      if (!exists) return code;
    }
    return `Q${Date.now().toString(36).toUpperCase()}`;
  }

  async create(dto: CreateQuotationDto, user: AuthUser) {
    const customer = await this.loadCustomer(dto.customerId, user);

    const existingForCustomer = await this.quotationsRepo.findOne({
      where: { customerId: customer.id },
      select: { id: true },
    });
    if (existingForCustomer) {
      throw new ConflictException(
        'This customer already has a quotation. Open the existing one instead.',
      );
    }

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

      const { columns: geo } =
        await this.rateColumns.rateGeographyForUser(user.id);
      const synced = syncMatrixToGeography(
        { columns, rows },
        geo.map((c) => ({
          id: c.id,
          label: c.label,
          sortOrder: c.sortOrder,
        })),
        'quotation',
      );
      columns = synced.columns;
      rows = synced.rows as RateRowData[];
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
      .where('quotation.deletedAt IS NULL')
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
        customer: { cityRef: true, stateRef: true },
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

  /** Best quotation for account booking rates: latest issued, else latest draft */
  async latestIssuedForCustomer(customerId: string, user: AuthUser) {
    await this.loadCustomer(customerId, user);
    const issued = await this.quotationsRepo.findOne({
      where: {
        customerId,
        status: QuotationStatus.ISSUED,
      },
      order: { quotationDate: 'DESC', createdAt: 'DESC' },
      relations: {
        customer: { cityRef: true, stateRef: true },
        template: true,
      },
    });
    if (issued) {
      this.assertOwner(issued, user);
      return this.sanitize(issued);
    }

    const draft = await this.quotationsRepo.findOne({
      where: { customerId },
      order: { quotationDate: 'DESC', createdAt: 'DESC' },
      relations: {
        customer: { cityRef: true, stateRef: true },
        template: true,
      },
    });
    if (!draft) {
      throw new NotFoundException(
        'No quotation found for this customer',
      );
    }
    this.assertOwner(draft, user);
    return this.sanitize(draft);
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
      quotation.quotationCode = await this.allocateQuotationCode(user.id);
    }
    quotation.status = QuotationStatus.ISSUED;

    try {
      await this.quotationsRepo.save(quotation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/duplicate key|unique constraint/i.test(msg)) {
        throw new ConflictException(
          'Could not issue quotation: quotation code already exists. Try again.',
        );
      }
      throw err;
    }
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.quotationsRepo.softDelete(id);
    return { deleted: true };
  }

  async sendEmail(id: string, dto: SendDocumentEmailDto, user: AuthUser) {
    const quotation = await this.findOne(id, user);
    if (quotation.status !== QuotationStatus.ISSUED) {
      throw new BadRequestException(
        'Issue the quotation before sending it by email',
      );
    }

    const doc = await this.document(id, user);
    const company = doc.letterhead.companyName || 'Courier';
    const code = doc.quotation.quotationCode || id.slice(0, 8);
    const to =
      dto.to?.trim() ||
      doc.customer.email?.trim() ||
      '';
    if (!to) {
      throw new BadRequestException(
        'Customer has no email. Enter a recipient address.',
      );
    }

    const subject =
      dto.subject?.trim() || `Quotation ${code} — ${company}`;
    const pdf = await this.documentMailPdf.buildQuotationPdf(doc);
    const html = this.documentMailPdf.buildEmailHtml({
      title: `Quotation ${code}`,
      greetingName: doc.customer.name,
      message: dto.message,
      companyName: company,
      details: [
        ['Quotation', code],
        ['Date', String(doc.quotation.quotationDate || '—')],
        ['Customer', String(doc.customer.name || '—')],
      ],
    });

    const result = await this.mailService.sendMail({
      issuerUserId: quotation.createdById,
      to,
      cc: dto.cc,
      subject,
      html,
      attachments: [
        {
          filename: `Quotation-${code}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    quotation.lastEmailedAt = new Date();
    quotation.lastEmailedTo = to;
    await this.quotationsRepo.save(quotation);

    return {
      ...result,
      lastEmailedAt: quotation.lastEmailedAt,
      lastEmailedTo: quotation.lastEmailedTo,
    };
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
          .filter((r) => r.sectionId === section.id && !r.isAdditional)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((r) => ({
            ...r,
            weightLabel:
              r.weightGrams != null
                ? weightLabelForGrams(section.id, r.weightGrams)
                : r.weightLabel,
          })),
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
        city:
          snapshot?.customerCity ??
          quotation.customer?.cityRef?.name ??
          null,
        state:
          snapshot?.customerState ??
          quotation.customer?.stateRef?.name ??
          null,
        pincode: snapshot?.customerPincode ?? quotation.customer?.pincode,
        phone: snapshot?.customerPhone ?? quotation.customer?.primaryPhone,
        email: snapshot?.customerEmail ?? quotation.customer?.primaryEmail,
      },
      terms: this.buildTermsDocument(info, snapshot, quotation.customer),
      columns,
      sections,
    };
  }

  private buildTermsDocument(
    info: UserInfo | null | undefined,
    snapshot: QuotationSnapshot | null | undefined,
    customer: Customer | null | undefined,
  ) {
    const sgst = Number(info?.sgstPercent ?? 9);
    const cgst = Number(info?.cgstPercent ?? 9);
    const igst = Number(info?.igstPercent ?? 0);
    const gstPercent =
      igst > 0 ? String(igst) : String(Number((sgst + cgst).toFixed(2)));
    const fovPercent = String(
      snapshot?.fovPercent ?? customer?.fovPercent ?? '0',
    );
    const fuelChargesExtraPercent = String(
      snapshot?.fuelChargesExtraPercent ??
        customer?.fuelChargesExtraPercent ??
        '0',
    );
    const insurancePercent = String(info?.insurancePercent ?? '2');
    const paymentDays = String(info?.paymentDays ?? 10);
    const volumetricDivisor = String(info?.volumetricDivisor ?? 5000);
    const ewayRaw = Number(info?.ewayBillThreshold ?? 50000);
    const ewayBillThreshold = Number.isFinite(ewayRaw)
      ? ewayRaw.toLocaleString('en-IN')
      : '50,000';
    const companyName =
      info?.companyName?.trim() || info?.fullName?.trim() || 'Courier';

    const lines = resolveTermsLines(info?.termsAndConditions, {
      companyName,
      fovPercent,
      fuelChargesExtraPercent,
      gstPercent,
      insurancePercent,
      paymentDays,
      volumetricDivisor,
      ewayBillThreshold,
    });

    return {
      fovPercent,
      fuelChargesExtraPercent,
      gstPercent,
      insurancePercent,
      paymentDays,
      volumetricDivisor,
      ewayBillThreshold,
      lines,
    };
  }
}
