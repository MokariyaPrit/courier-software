import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InvoiceStatus, Role } from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Invoice } from '../entities/invoice.entity';
import { User } from '../entities/user.entity';
import { GstReportQueryDto } from './dto/gst-report-query.dto';

const HSN_SAC = '996812';
const HSN_DESC = 'COURIER SERVICE';

function n(value: string | number | null | undefined) {
  return Number(value || 0);
}

function money(value: number) {
  return value.toFixed(2);
}

function issuerFromUser(user?: User | null) {
  const info = user?.userInfo;
  return {
    userId: user?.id || null,
    companyName: info?.companyName || info?.fullName || user?.email || 'Courier',
    gstin: info?.gstin || null,
    pan: info?.panNumber || null,
    state: info?.state || null,
    address: info?.address || null,
  };
}

@Injectable()
export class GstReportsService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async caGstReport(query: GstReportQueryDto, user: AuthUser) {
    if (query.dateFrom > query.dateTo) {
      throw new BadRequestException('Start date must be on or before end date');
    }

    const qb = this.invoicesRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'customer')
      .leftJoinAndSelect('inv.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .where('inv.deletedAt IS NULL')
      .andWhere('inv.status != :cancelled', {
        cancelled: InvoiceStatus.CANCELLED,
      })
      .andWhere('inv.billDate >= :dateFrom', {
        dateFrom: query.dateFrom.slice(0, 10),
      })
      .andWhere('inv.billDate <= :dateTo', {
        dateTo: query.dateTo.slice(0, 10),
      })
      .orderBy('inv.billDate', 'ASC')
      .addOrderBy('inv.invoiceNumber', 'ASC');

    // Branch managers / users: only their own bills
    if (user.role !== Role.ADMIN) {
      qb.andWhere('inv.createdById = :uid', { uid: user.id });
    }
    if (query.customerId) {
      qb.andWhere('inv.customerId = :customerId', {
        customerId: query.customerId,
      });
    }

    const invoices = await qb.getMany();

    const rows = invoices.map((inv) => {
      const taxableValue = n(inv.subTotal);
      const cgst = n(inv.cgstAmount);
      const sgst = n(inv.sgstAmount);
      const igst = n(inv.igstAmount);
      const roundOff = n(inv.roundOffAmount);
      const invoiceValue = n(inv.totalAmount);
      const customer = inv.customer;
      const issuer = issuerFromUser(inv.createdBy);

      return {
        id: inv.id,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        billDate: inv.billDate,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        customerId: inv.customerId,
        customerName: customer?.name || '—',
        customerGstin: customer?.gstin || null,
        customerPan: customer?.panNumber || null,
        customerState: customer?.state || null,
        customerCity: customer?.city || null,
        issuerUserId: issuer.userId,
        issuerName: issuer.companyName,
        issuerGstin: issuer.gstin,
        issuerPan: issuer.pan,
        hsnSac: HSN_SAC,
        hsnDescription: HSN_DESC,
        taxableValue: money(taxableValue),
        cgstPercent: money(n(inv.cgstPercent)),
        cgstAmount: money(cgst),
        sgstPercent: money(n(inv.sgstPercent)),
        sgstAmount: money(sgst),
        igstPercent: money(n(inv.igstPercent)),
        igstAmount: money(igst),
        roundOffAmount: money(roundOff),
        invoiceValue: money(invoiceValue),
        status: inv.status,
      };
    });

    const byCustomer = new Map<
      string,
      {
        id: string;
        customerId: string;
        customerName: string;
        customerGstin: string | null;
        customerPan: string | null;
        customerState: string | null;
        invoiceCount: number;
        taxableValue: number;
        cgstAmount: number;
        sgstAmount: number;
        igstAmount: number;
        roundOffAmount: number;
        invoiceValue: number;
      }
    >();

    for (const row of rows) {
      const key = row.customerId;
      const existing = byCustomer.get(key) ?? {
        id: row.customerId,
        customerId: row.customerId,
        customerName: row.customerName,
        customerGstin: row.customerGstin,
        customerPan: row.customerPan,
        customerState: row.customerState,
        invoiceCount: 0,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        roundOffAmount: 0,
        invoiceValue: 0,
      };
      existing.invoiceCount += 1;
      existing.taxableValue += n(row.taxableValue);
      existing.cgstAmount += n(row.cgstAmount);
      existing.sgstAmount += n(row.sgstAmount);
      existing.igstAmount += n(row.igstAmount);
      existing.roundOffAmount += n(row.roundOffAmount);
      existing.invoiceValue += n(row.invoiceValue);
      byCustomer.set(key, existing);
    }

    const customerSummary = [...byCustomer.values()]
      .sort((a, b) => a.customerName.localeCompare(b.customerName))
      .map((c) => ({
        ...c,
        taxableValue: money(c.taxableValue),
        cgstAmount: money(c.cgstAmount),
        sgstAmount: money(c.sgstAmount),
        igstAmount: money(c.igstAmount),
        roundOffAmount: money(c.roundOffAmount),
        invoiceValue: money(c.invoiceValue),
      }));

    const byIssuer = new Map<
      string,
      {
        id: string;
        userId: string;
        companyName: string;
        gstin: string | null;
        pan: string | null;
        invoiceCount: number;
        taxableValue: number;
        cgstAmount: number;
        sgstAmount: number;
        igstAmount: number;
        invoiceValue: number;
      }
    >();

    for (const row of rows) {
      const key = row.issuerUserId || 'unknown';
      const existing = byIssuer.get(key) ?? {
        id: key,
        userId: key,
        companyName: row.issuerName,
        gstin: row.issuerGstin,
        pan: row.issuerPan,
        invoiceCount: 0,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        invoiceValue: 0,
      };
      existing.invoiceCount += 1;
      existing.taxableValue += n(row.taxableValue);
      existing.cgstAmount += n(row.cgstAmount);
      existing.sgstAmount += n(row.sgstAmount);
      existing.igstAmount += n(row.igstAmount);
      existing.invoiceValue += n(row.invoiceValue);
      byIssuer.set(key, existing);
    }

    const issuerSummary = [...byIssuer.values()]
      .sort((a, b) => a.companyName.localeCompare(b.companyName))
      .map((i) => ({
        ...i,
        taxableValue: money(i.taxableValue),
        cgstAmount: money(i.cgstAmount),
        sgstAmount: money(i.sgstAmount),
        igstAmount: money(i.igstAmount),
        invoiceValue: money(i.invoiceValue),
      }));

    const totals = rows.reduce(
      (acc, row) => {
        acc.invoiceCount += 1;
        acc.taxableValue += n(row.taxableValue);
        acc.cgstAmount += n(row.cgstAmount);
        acc.sgstAmount += n(row.sgstAmount);
        acc.igstAmount += n(row.igstAmount);
        acc.roundOffAmount += n(row.roundOffAmount);
        acc.invoiceValue += n(row.invoiceValue);
        return acc;
      },
      {
        invoiceCount: 0,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        roundOffAmount: 0,
        invoiceValue: 0,
      },
    );

    // Single issuer when all bills belong to one user; otherwise list for admin
    const primaryIssuer =
      issuerSummary.length === 1
        ? {
            companyName: issuerSummary[0].companyName,
            gstin: issuerSummary[0].gstin,
            pan: issuerSummary[0].pan,
            state: null as string | null,
            address: null as string | null,
            multiIssuer: false,
          }
        : issuerSummary.length > 1
          ? {
              companyName: `${issuerSummary.length} issuers (see Issuer column)`,
              gstin: null,
              pan: null,
              state: null,
              address: null,
              multiIssuer: true,
            }
          : issuerFromUser(
              await this.usersRepo.findOne({
                where: { id: user.id },
                relations: { userInfo: true },
              }),
            );

    return {
      meta: {
        dateFrom: query.dateFrom.slice(0, 10),
        dateTo: query.dateTo.slice(0, 10),
        generatedAt: new Date().toISOString(),
        hsnSac: HSN_SAC,
        hsnDescription: HSN_DESC,
        scopedToOwnInvoices: user.role !== Role.ADMIN,
      },
      issuer: {
        companyName: primaryIssuer.companyName,
        gstin: primaryIssuer.gstin,
        pan: primaryIssuer.pan,
        state: 'state' in primaryIssuer ? primaryIssuer.state : null,
        address: 'address' in primaryIssuer ? primaryIssuer.address : null,
        multiIssuer: Boolean(
          'multiIssuer' in primaryIssuer && primaryIssuer.multiIssuer,
        ),
      },
      issuerSummary,
      rows,
      customerSummary,
      totals: {
        invoiceCount: totals.invoiceCount,
        customerCount: customerSummary.length,
        issuerCount: issuerSummary.length,
        taxableValue: money(totals.taxableValue),
        cgstAmount: money(totals.cgstAmount),
        sgstAmount: money(totals.sgstAmount),
        igstAmount: money(totals.igstAmount),
        roundOffAmount: money(totals.roundOffAmount),
        invoiceValue: money(totals.invoiceValue),
      },
    };
  }
}
