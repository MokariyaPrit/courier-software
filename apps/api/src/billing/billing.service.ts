import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BookingType,
  InvoiceStatus,
  QUOTATION_SERVICE_TYPE_LABELS,
  QuotationServiceType,
  Role,
} from '@courier/shared';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  paginateMeta,
  resolveSortPair,
} from '../common/dto/pagination.dto';
import { Consignment } from '../entities/consignment.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import { User } from '../entities/user.entity';
import { DocumentMailPdfService } from '../mail/document-mail-pdf.service';
import { SendDocumentEmailDto } from '../mail/dto/send-document-email.dto';
import { MailService } from '../mail/mail.service';
import { BulkEmailInvoicesDto } from './dto/bulk-email-invoices.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

const INVOICE_SORT = [
  'invoiceNumber',
  'totalAmount',
  'status',
  'billDate',
  'createdAt',
] as const;

const HSN_SAC = '996812 / COURIER SERVICE';

function money(n: number) {
  return n.toFixed(2);
}

function panFromGstin(gstin?: string | null) {
  const g = (gstin || '').replace(/\s/g, '').toUpperCase();
  if (g.length >= 12) return g.slice(2, 12);
  return null;
}

function consignmentTypeLabel(c: Consignment) {
  const sid = String(c.rateSectionId || '').trim();
  if (sid && sid in QUOTATION_SERVICE_TYPE_LABELS) {
    return QUOTATION_SERVICE_TYPE_LABELS[sid as QuotationServiceType];
  }
  const upper = sid.toUpperCase();
  if (upper.includes('DOX_BY_AIR')) return 'DOX BY AIR';
  if (upper.includes('PARCEL_BY_AIR')) return 'PARCEL BY AIR';
  if (upper.includes('DOX')) return 'DOX';
  if (upper.includes('PARCEL')) return 'PARCEL';
  if (upper.includes('TATKAL')) return 'TATKAL';
  return sid || '—';
}

/** Invoice weight label — DOX in grams, parcels in kg (matches booking UI). */
function consignmentWeightLabel(c: Consignment) {
  const kg = Number(c.weightKg || 0);
  if (!Number.isFinite(kg) || kg <= 0) return '0';
  const grams = Math.round(kg * 1000);
  const sid = String(c.rateSectionId || '').toUpperCase();
  const isParcel =
    sid.includes('PARCEL') && !sid.includes('DOX');
  if (isParcel || grams >= 1000) {
    const value = grams / 1000;
    return `${value % 1 === 0 ? value.toFixed(0) : parseFloat(value.toFixed(3))} kg`;
  }
  return `${grams} g`;
}

function freightOf(c: Consignment) {
  return Number(c.price || 0);
}

function nestErrorMessage(err: unknown, fallback: string) {
  if (err instanceof BadRequestException || err instanceof NotFoundException) {
    const res = err.getResponse();
    if (typeof res === 'string' && res.trim()) return res;
    if (res && typeof res === 'object') {
      const msg = (res as { message?: string | string[] }).message;
      if (Array.isArray(msg)) return msg.join(', ');
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

type GstRates = {
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
};

/** Indian-style amount in words (rupees, no paise fraction wording). */
export function amountInWords(amount: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const twoDigits = (n: number) => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`.trim();
  };

  const threeDigits = (n: number) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (h && r) return `${ones[h]} Hundred ${twoDigits(r)}`;
    if (h) return `${ones[h]} Hundred`;
    return twoDigits(r);
  };

  const rupees = Math.round(Math.abs(amount));
  if (rupees === 0) return 'Zero Only';

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  return `${parts.join(' ')} Only`;
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice) private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(Customer) private readonly customersRepo: Repository<Customer>,
    @InjectRepository(Consignment)
    private readonly consignmentsRepo: Repository<Consignment>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly mailService: MailService,
    private readonly documentMailPdf: DocumentMailPdfService,
  ) {}

  private async nextInvoiceNumber() {
    const count = await this.invoicesRepo.count({ withDeleted: true });
    const year = new Date().getFullYear();
    return `${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async billedConsignmentIdSet(excludeInvoiceId?: string) {
    const qb = this.invoicesRepo
      .createQueryBuilder('inv')
      .select(['inv.id', 'inv.consignmentIds', 'inv.status'])
      .where('inv.deletedAt IS NULL')
      .andWhere('inv.status != :cancelled', {
        cancelled: InvoiceStatus.CANCELLED,
      });
    if (excludeInvoiceId) {
      qb.andWhere('inv.id != :excludeId', { excludeId: excludeInvoiceId });
    }
    const invoices = await qb.getMany();
    const set = new Set<string>();
    for (const inv of invoices) {
      for (const id of inv.consignmentIds ?? []) {
        set.add(id);
      }
    }
    return set;
  }

  /** Block reuse of the same booking / AWB on another active bill. */
  private async assertBookingsNotAlreadyBilled(
    consignments: Consignment[],
    excludeInvoiceId?: string,
  ) {
    if (!consignments.length) return;

    const billedIds = await this.billedConsignmentIdSet(excludeInvoiceId);
    const alreadyById = consignments.filter((c) => billedIds.has(c.id));
    if (alreadyById.length) {
      const awbs = alreadyById.map((c) => c.awb).join(', ');
      throw new BadRequestException(
        `These AWB(s) are already included in another bill: ${awbs}`,
      );
    }

    const awbs = [
      ...new Set(
        consignments
          .map((c) => (c.awb || '').trim())
          .filter(Boolean)
          .map((a) => a.toUpperCase()),
      ),
    ];
    if (!awbs.length || !billedIds.size) return;

    const billedConsignments = await this.consignmentsRepo.find({
      where: { id: In([...billedIds]) },
      select: { id: true, awb: true },
    });
    const billedAwbMap = new Map<string, string>();
    for (const c of billedConsignments) {
      const key = (c.awb || '').trim().toUpperCase();
      if (key) billedAwbMap.set(key, c.awb);
    }

    const conflicts = awbs.filter((a) => billedAwbMap.has(a));
    if (conflicts.length) {
      throw new BadRequestException(
        `These AWB(s) are already included in another bill: ${conflicts
          .map((a) => billedAwbMap.get(a) || a)
          .join(', ')}`,
      );
    }
  }

  private async resolveGstRates(
    user: AuthUser,
    overrides?: Partial<GstRates>,
  ): Promise<GstRates> {
    const issuer = await this.usersRepo.findOne({
      where: { id: user.id },
      relations: { userInfo: true },
    });
    const info = issuer?.userInfo;
    return {
      sgstPercent:
        overrides?.sgstPercent ?? Number(info?.sgstPercent ?? 9),
      cgstPercent:
        overrides?.cgstPercent ?? Number(info?.cgstPercent ?? 9),
      igstPercent:
        overrides?.igstPercent ?? Number(info?.igstPercent ?? 0),
    };
  }

  private totalsFromConsignments(
    consignments: Consignment[],
    fuelPercent: number,
    rates: GstRates,
  ) {
    const gross = consignments.reduce((s, c) => s + freightOf(c), 0);
    const fuel = Number(((gross * fuelPercent) / 100).toFixed(2));
    const subTotal = Number((gross + fuel).toFixed(2));
    const cgst = Number(((subTotal * rates.cgstPercent) / 100).toFixed(2));
    const sgst = Number(((subTotal * rates.sgstPercent) / 100).toFixed(2));
    const igst = Number(((subTotal * rates.igstPercent) / 100).toFixed(2));
    const beforeRound = Number((subTotal + cgst + sgst + igst).toFixed(2));
    const total = Math.round(beforeRound);
    const roundOff = Number((total - beforeRound).toFixed(2));
    return {
      grossAmount: money(gross),
      fuelSurcharge: money(fuel),
      subTotal: money(subTotal),
      cgstPercent: money(rates.cgstPercent),
      sgstPercent: money(rates.sgstPercent),
      igstPercent: money(rates.igstPercent),
      cgstAmount: money(cgst),
      sgstAmount: money(sgst),
      igstAmount: money(igst),
      roundOffAmount: money(roundOff),
      totalAmount: money(total),
    };
  }

  async create(dto: CreateInvoiceDto, user: AuthUser) {
    const customer = await this.customersRepo.findOne({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }
    if (user.role !== Role.ADMIN && customer.createdById !== user.id) {
      throw new BadRequestException('Customer not found');
    }

    const consignments = await this.consignmentsRepo.find({
      where: { id: In(dto.consignmentIds) },
    });
    if (consignments.length !== dto.consignmentIds.length) {
      throw new BadRequestException('One or more consignments not found');
    }

    await this.assertBookingsNotAlreadyBilled(consignments);

    const fuelPercent = Number(customer.fuelChargesExtraPercent || 0);
    const rates = await this.resolveGstRates(user);
    const totals = this.totalsFromConsignments(
      consignments,
      fuelPercent,
      rates,
    );
    const today = new Date().toISOString().slice(0, 10);

    const invoice = this.invoicesRepo.create({
      invoiceNumber: await this.nextInvoiceNumber(),
      customerId: dto.customerId,
      status: InvoiceStatus.ISSUED,
      billDate: today,
      periodStart: null,
      periodEnd: null,
      ...totals,
      consignmentIds: dto.consignmentIds,
      notes: dto.notes ?? null,
      createdById: user.id,
    });

    return this.invoicesRepo.save(invoice);
  }

  async generate(dto: GenerateInvoicesDto, user: AuthUser) {
    if (dto.dateFrom > dto.dateTo) {
      throw new BadRequestException('Start date must be on or before end date');
    }

    const uniqueIds = [...new Set(dto.customerIds)];
    const customers = await this.customersRepo.find({
      where: { id: In(uniqueIds) },
    });
    if (customers.length !== uniqueIds.length) {
      throw new BadRequestException('One or more customers not found');
    }

    for (const customer of customers) {
      if (user.role !== Role.ADMIN && customer.createdById !== user.id) {
        throw new BadRequestException(
          `Customer "${customer.name}" is not available for billing`,
        );
      }
    }

    const billed = await this.billedConsignmentIdSet();
    const rates = await this.resolveGstRates(user, {
      sgstPercent: dto.sgstPercent,
      cgstPercent: dto.cgstPercent,
      igstPercent: dto.igstPercent,
    });
    const created: Invoice[] = [];
    const skipped: Array<{
      customerId: string;
      customerName: string;
      reason: string;
    }> = [];

    for (const customer of customers) {
      const qb = this.consignmentsRepo
        .createQueryBuilder('c')
        .where('c.deletedAt IS NULL')
        .andWhere('c.customerId = :customerId', { customerId: customer.id })
        .andWhere('c.bookingType = :bookingType', {
          bookingType: BookingType.ACCOUNT,
        })
        .andWhere(
          'COALESCE(c.bookingDate, CAST(c.createdAt AS date)) >= :dateFrom',
          { dateFrom: dto.dateFrom },
        )
        .andWhere(
          'COALESCE(c.bookingDate, CAST(c.createdAt AS date)) <= :dateTo',
          { dateTo: dto.dateTo },
        )
        .orderBy('COALESCE(c.bookingDate, CAST(c.createdAt AS date))', 'ASC')
        .addOrderBy('c.createdAt', 'ASC');

      if (user.role !== Role.ADMIN) {
        qb.andWhere('c.createdById = :uid', { uid: user.id });
      }

      const consignments = await qb.getMany();
      const unbilled = consignments.filter((c) => !billed.has(c.id));

      if (!unbilled.length) {
        skipped.push({
          customerId: customer.id,
          customerName: customer.name,
          reason: consignments.length
            ? 'All account bookings in this period are already billed'
            : 'No account bookings found in this period',
        });
        continue;
      }

      // AWB already on another bill (including same AWB string)
      try {
        await this.assertBookingsNotAlreadyBilled(unbilled);
      } catch (err) {
        skipped.push({
          customerId: customer.id,
          customerName: customer.name,
          reason:
            err instanceof BadRequestException
              ? String(err.message)
              : 'Bookings already billed',
        });
        continue;
      }

      const fuelPercent = Number(customer.fuelChargesExtraPercent || 0);
      const totals = this.totalsFromConsignments(unbilled, fuelPercent, rates);
      const ids = unbilled.map((c) => c.id);

      const invoice = this.invoicesRepo.create({
        invoiceNumber: await this.nextInvoiceNumber(),
        customerId: customer.id,
        status: InvoiceStatus.ISSUED,
        billDate: dto.billDate.slice(0, 10),
        periodStart: dto.dateFrom.slice(0, 10),
        periodEnd: dto.dateTo.slice(0, 10),
        ...totals,
        consignmentIds: ids,
        notes: null,
        createdById: user.id,
      });

      const saved = await this.invoicesRepo.save(invoice);
      created.push(saved);
      for (const id of ids) billed.add(id);
    }

    if (!created.length) {
      throw new BadRequestException(
        skipped[0]?.reason ||
          'No invoices generated for the selected customers and date range',
      );
    }

    return {
      invoices: created,
      skipped,
      meta: { created: created.length, skipped: skipped.length },
    };
  }

  async findAll(query: InvoiceQueryDto, user: AuthUser) {
    const { sortBy, sortOrder } = resolveSortPair(query, INVOICE_SORT, {
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
    const qb = this.invoicesRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'customer')
      .where('inv.deletedAt IS NULL')
      .orderBy(`inv.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (user.role !== Role.ADMIN) {
      qb.andWhere('inv.createdById = :uid', { uid: user.id });
    }

    const dateFrom = query.dateFrom?.trim();
    const dateTo = query.dateTo?.trim();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('dateFrom must be on or before dateTo');
    }
    if (dateFrom) {
      qb.andWhere('inv.billDate >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('inv.billDate <= :dateTo', { dateTo });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      data: items,
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const invoice = await this.invoicesRepo.findOne({
      where: { id },
      relations: {
        customer: true,
        createdBy: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (user.role !== Role.ADMIN && invoice.createdById !== user.id) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async findDocument(id: string, user: AuthUser) {
    const invoice = await this.findOne(id, user);
    const issuer = await this.usersRepo.findOne({
      where: { id: invoice.createdById },
      relations: { userInfo: true },
    });
    const info = issuer?.userInfo;

    const consignments = invoice.consignmentIds?.length
      ? await this.consignmentsRepo.find({
          where: { id: In(invoice.consignmentIds) },
          order: { bookingDate: 'ASC', createdAt: 'ASC' },
          // Keep billed lines even if a booking was soft-deleted earlier
          withDeleted: true,
        })
      : [];

    // Keep line order as stored on invoice when possible
    const byId = new Map(consignments.map((c) => [c.id, c]));
    const ordered = (invoice.consignmentIds ?? [])
      .map((cid) => byId.get(cid))
      .filter((c): c is Consignment => Boolean(c));

    const customer = invoice.customer;
    const gstin = info?.gstin || null;
    const companyPan =
      info?.panNumber || panFromGstin(gstin) || null;
    const customerPan =
      customer?.panNumber || panFromGstin(customer?.gstin) || null;

    // Ensure Total Bill Amount and Amount in Words use nearest-rupee round-off
    let totalAmount = Number(invoice.totalAmount || 0);
    let roundOffAmount = Number(invoice.roundOffAmount || 0);
    if (
      Math.abs(totalAmount - Math.round(totalAmount)) > 0.001 &&
      Math.abs(roundOffAmount) < 0.001
    ) {
      const rounded = Math.round(totalAmount);
      roundOffAmount = Number((rounded - totalAmount).toFixed(2));
      totalAmount = rounded;
    }

    return {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        billDate: invoice.billDate,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        grossAmount: invoice.grossAmount,
        fuelSurcharge: invoice.fuelSurcharge,
        subTotal: invoice.subTotal,
        cgstPercent: invoice.cgstPercent,
        sgstPercent: invoice.sgstPercent,
        igstPercent: invoice.igstPercent,
        cgstAmount: invoice.cgstAmount,
        sgstAmount: invoice.sgstAmount,
        igstAmount: invoice.igstAmount,
        roundOffAmount: money(roundOffAmount),
        totalAmount: money(totalAmount),
        notes: invoice.notes,
        amountInWords: amountInWords(totalAmount),
        hsnSac: HSN_SAC,
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
        gstin,
        pan: companyPan,
        bankName: info?.bankName || null,
        bankAccountNo: info?.bankAccountNo || null,
        bankIfsc: info?.bankIfsc || null,
        upiId: info?.upiId || null,
        franchiseNote: info?.notes || null,
      },
      customer: {
        id: customer?.id,
        name: customer?.name || '—',
        address: customer?.address || null,
        city: customer?.city || null,
        state: customer?.state || null,
        pincode: customer?.pincode || null,
        gstin: customer?.gstin || null,
        pan: customerPan,
        phone: customer?.primaryPhone || null,
        email: customer?.primaryEmail || null,
      },
      lines: ordered.map((c) => {
        const bookingDate =
          c.bookingDate ||
          (c.createdAt
            ? new Date(c.createdAt).toISOString().slice(0, 10)
            : null);
        return {
          id: c.id,
          date: bookingDate,
          awb: c.awb,
          type: consignmentTypeLabel(c),
          partyName: c.receiverName,
          center: c.receiverCity || c.receiverState || '—',
          weightKg: c.weightKg,
          weightLabel: consignmentWeightLabel(c),
          amount: money(freightOf(c)),
        };
      }),
    };
  }

  async sendEmail(id: string, dto: SendDocumentEmailDto, user: AuthUser) {
    return this.sendOneInvoiceEmail(id, user, {
      to: dto.to,
      cc: dto.cc,
      subject: dto.subject,
      message: dto.message,
      requireTo: Boolean(dto.to?.trim()),
    });
  }

  /**
   * Send selected invoices to each customer's primary email (sequential).
   * Skips invoices without a customer email and continues the rest.
   */
  async sendEmailBulk(dto: BulkEmailInvoicesDto, user: AuthUser) {
    const uniqueIds = [...new Set(dto.ids.map((id) => String(id)))];
    const sent: Array<{
      id: string;
      invoiceNumber: string;
      to: string;
    }> = [];
    const failed: Array<{
      id: string;
      invoiceNumber?: string;
      reason: string;
    }> = [];

    for (const id of uniqueIds) {
      try {
        const result = await this.sendOneInvoiceEmail(id, user, {
          message: dto.message,
          requireTo: false,
        });
        sent.push({
          id,
          invoiceNumber: result.invoiceNumber,
          to: result.to,
        });
      } catch (err: unknown) {
        let invoiceNumber: string | undefined;
        try {
          const inv = await this.findOne(id, user);
          invoiceNumber = inv.invoiceNumber;
        } catch {
          /* ignore */
        }
        failed.push({
          id,
          invoiceNumber,
          reason: nestErrorMessage(err, 'Failed to send invoice email'),
        });
      }
    }

    return {
      sent,
      failed,
      meta: {
        requested: uniqueIds.length,
        sent: sent.length,
        failed: failed.length,
      },
    };
  }

  private async sendOneInvoiceEmail(
    id: string,
    user: AuthUser,
    opts: {
      to?: string;
      cc?: string;
      subject?: string;
      message?: string;
      /** When true, missing `to` is an error even if customer has email unset */
      requireTo?: boolean;
    },
  ) {
    const invoice = await this.findOne(id, user);
    const doc = await this.findDocument(id, user);
    const company = doc.letterhead.companyName || 'Courier';
    const number = doc.invoice.invoiceNumber;
    const to = opts.to?.trim() || doc.customer.email?.trim() || '';
    if (!to) {
      throw new BadRequestException(
        opts.requireTo
          ? 'Recipient email is required'
          : `No email for ${doc.customer.name || 'customer'} (invoice ${number})`,
      );
    }

    const subject =
      opts.subject?.trim() || `Tax Invoice ${number} — ${company}`;
    const pdf = await this.documentMailPdf.buildInvoicePdf(doc);
    const html = this.documentMailPdf.buildEmailHtml({
      title: `Tax Invoice ${number}`,
      greetingName: doc.customer.name,
      message: opts.message,
      companyName: company,
      details: [
        ['Invoice', number],
        ['Bill date', String(doc.invoice.billDate || '—')],
        ['Customer', String(doc.customer.name || '—')],
        ['Total', `₹${doc.invoice.totalAmount}`],
      ],
    });

    const result = await this.mailService.sendMail({
      issuerUserId: invoice.createdById,
      to,
      cc: opts.cc,
      subject,
      html,
      attachments: [
        {
          filename: `Invoice-${number}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    invoice.lastEmailedAt = new Date();
    invoice.lastEmailedTo = to;
    await this.invoicesRepo.save(invoice);

    return {
      ...result,
      invoiceNumber: number,
      lastEmailedAt: invoice.lastEmailedAt,
      lastEmailedTo: invoice.lastEmailedTo,
    };
  }

  async remove(id: string, user: AuthUser) {
    const invoice = await this.findOne(id, user);
    await this.invoicesRepo.softDelete(invoice.id);
    return { deleted: true, id: invoice.id };
  }

  async customerStatement(customerId: string, user: AuthUser) {
    const customer = await this.customersRepo.findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    if (user.role !== Role.ADMIN && customer.createdById !== user.id) {
      throw new NotFoundException('Customer not found');
    }
    const invoices = await this.invoicesRepo.find({
      where:
        user.role === Role.ADMIN
          ? { customerId }
          : { customerId, createdById: user.id },
      order: { createdAt: 'DESC' },
    });
    const totalIssued = invoices.reduce(
      (s, i) => s + Number(i.totalAmount),
      0,
    );
    return { customer, invoices, totalIssued };
  }
}
