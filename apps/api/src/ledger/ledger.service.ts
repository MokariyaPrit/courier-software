import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  InvoicePaymentStatus,
  InvoiceStatus,
  LedgerTxnType,
  Role,
} from '@courier/shared';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { locationNames } from '../common/utils/location-names';
import { CustomerPayment } from '../entities/customer-payment.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import { PaymentAllocation } from '../entities/payment-allocation.entity';
import {
  CreatePaymentDto,
  LedgerCustomerQueryDto,
  LedgerDetailQueryDto,
} from './dto/ledger.dto';

function money(n: number) {
  return Number(n || 0).toFixed(2);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function paymentStatusOf(inv: Invoice): InvoicePaymentStatus {
  const total = Number(inv.totalAmount || 0);
  const paid = Number(inv.amountPaid || 0);
  if (paid <= 0.001) return InvoicePaymentStatus.UNPAID;
  if (paid + 0.001 >= total) return InvoicePaymentStatus.PAID;
  return InvoicePaymentStatus.PARTIAL;
}

function remainingDue(inv: Invoice) {
  return Math.max(
    0,
    round2(Number(inv.totalAmount || 0) - Number(inv.amountPaid || 0)),
  );
}

type LedgerRow = {
  id: string;
  date: string;
  type: LedgerTxnType;
  reference: string;
  debit: string;
  credit: string;
  balance: string;
  invoiceId?: string;
  paymentId?: string;
  paymentStatus?: InvoicePaymentStatus;
  mode?: string;
};

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepo: Repository<Customer>,
    @InjectRepository(Invoice)
    private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(CustomerPayment)
    private readonly paymentsRepo: Repository<CustomerPayment>,
    @InjectRepository(PaymentAllocation)
    private readonly allocationsRepo: Repository<PaymentAllocation>,
  ) {}

  private customerScope(user: AuthUser) {
    return user.role === Role.ADMIN ? {} : { createdById: user.id };
  }

  private async getCustomerOrThrow(customerId: string, user: AuthUser) {
    const customer = await this.customersRepo.findOne({
      where: { id: customerId, ...this.customerScope(user) },
      relations: { cityRef: true, stateRef: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  private async loadInvoices(customerId: string, user: AuthUser) {
    const qb = this.invoicesRepo
      .createQueryBuilder('i')
      .where('i.deletedAt IS NULL')
      .andWhere('i.customerId = :customerId', { customerId })
      .andWhere('i.status IN (:...st)', {
        st: [InvoiceStatus.ISSUED, InvoiceStatus.PAID],
      })
      .orderBy('i.billDate', 'ASC')
      .addOrderBy('i.createdAt', 'ASC');
    if (user.role !== Role.ADMIN) {
      qb.andWhere('i.createdById = :uid', { uid: user.id });
    }
    return qb.getMany();
  }

  private async loadPayments(customerId: string, user: AuthUser) {
    const qb = this.paymentsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.allocations', 'a')
      .where('p.deletedAt IS NULL')
      .andWhere('p.customerId = :customerId', { customerId })
      .orderBy('p.paymentDate', 'ASC')
      .addOrderBy('p.createdAt', 'ASC');
    if (user.role !== Role.ADMIN) {
      qb.andWhere('p.createdById = :uid', { uid: user.id });
    }
    return qb.getMany();
  }

  private summarize(invoices: Invoice[], payments: CustomerPayment[]) {
    const totalBilled = round2(
      invoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0),
    );
    const totalPaid = round2(
      payments.reduce((s, p) => s + Number(p.amount || 0), 0),
    );
    const outstanding = round2(
      invoices.reduce((s, i) => s + remainingDue(i), 0),
    );
    return {
      totalBilled: money(totalBilled),
      totalPaid: money(totalPaid),
      outstanding: money(outstanding),
    };
  }

  private buildLedgerRows(
    invoices: Invoice[],
    payments: CustomerPayment[],
    query: LedgerDetailQueryDto,
  ): LedgerRow[] {
    type Raw = {
      sortKey: string;
      tie: number;
      row: Omit<LedgerRow, 'balance'>;
    };
    const raw: Raw[] = [];

    for (const inv of invoices) {
      const status = paymentStatusOf(inv);
      if (query.paymentStatus && status !== query.paymentStatus) continue;
      const date = (inv.billDate || inv.createdAt.toISOString().slice(0, 10)).slice(
        0,
        10,
      );
      if (query.dateFrom && date < query.dateFrom.slice(0, 10)) continue;
      if (query.dateTo && date > query.dateTo.slice(0, 10)) continue;
      if (query.type && query.type !== LedgerTxnType.BILL) continue;
      raw.push({
        sortKey: date,
        tie: inv.createdAt.getTime(),
        row: {
          id: `bill:${inv.id}`,
          date,
          type: LedgerTxnType.BILL,
          reference: inv.invoiceNumber,
          debit: money(Number(inv.totalAmount)),
          credit: money(0),
          invoiceId: inv.id,
          paymentStatus: status,
        },
      });
    }

    for (const pay of payments) {
      if (query.type && query.type !== LedgerTxnType.PAYMENT) continue;
      if (query.paymentStatus) continue; // payment-status filter is invoice-oriented
      const date = pay.paymentDate.slice(0, 10);
      if (query.dateFrom && date < query.dateFrom.slice(0, 10)) continue;
      if (query.dateTo && date > query.dateTo.slice(0, 10)) continue;
      const ref =
        pay.referenceNo?.trim() ||
        `PAY-${pay.id.slice(0, 8).toUpperCase()}`;
      raw.push({
        sortKey: date,
        tie: pay.createdAt.getTime(),
        row: {
          id: `pay:${pay.id}`,
          date,
          type: LedgerTxnType.PAYMENT,
          reference: ref,
          debit: money(0),
          credit: money(Number(pay.amount)),
          paymentId: pay.id,
          mode: pay.mode,
        },
      });
    }

    raw.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey.localeCompare(b.sortKey);
      return a.tie - b.tie;
    });

    let balance = 0;
    return raw.map((r) => {
      balance = round2(
        balance + Number(r.row.debit) - Number(r.row.credit),
      );
      return { ...r.row, balance: money(balance) };
    });
  }

  async listCustomers(query: LedgerCustomerQueryDto, user: AuthUser) {
    const isAdmin = user.role === Role.ADMIN;
    const qb = this.customersRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.cityRef', 'cityRef')
      .leftJoinAndSelect('c.stateRef', 'stateRef')
      .leftJoinAndSelect('c.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .where('c.deletedAt IS NULL')
      .andWhere('c.isActive = true')
      .orderBy('c.name', 'ASC');
    if (!isAdmin) {
      qb.andWhere('c.createdById = :uid', { uid: user.id });
    }
    const rawSearch = query.search?.trim();
    if (rawSearch) {
      const q = `%${rawSearch}%`;
      const qCompact = `%${rawSearch.replace(/\s+/g, '')}%`;
      const clauses = [
        'c.name ILIKE :q',
        'REPLACE(c.name, \' \', \'\') ILIKE :qCompact',
        'c.primaryPhone ILIKE :q',
        'c.primaryEmail ILIKE :q',
        'c.gstin ILIKE :q',
        'cityRef.name ILIKE :q',
      ];
      if (isAdmin) {
        clauses.push(
          'createdByInfo.fullName ILIKE :q',
          'createdBy.email ILIKE :q',
        );
      }
      qb.andWhere(`(${clauses.join(' OR ')})`, { q, qCompact });
    }
    const customers = await qb.getMany();
    if (!customers.length) return { data: [] };

    const ids = customers.map((c) => c.id);
    const invQb = this.invoicesRepo
      .createQueryBuilder('i')
      .where('i.deletedAt IS NULL')
      .andWhere('i.customerId IN (:...ids)', { ids })
      .andWhere('i.status IN (:...st)', {
        st: [InvoiceStatus.ISSUED, InvoiceStatus.PAID],
      });
    if (!isAdmin) {
      invQb.andWhere('i.createdById = :uid', { uid: user.id });
    }
    const invoices = await invQb.getMany();

    const payQb = this.paymentsRepo
      .createQueryBuilder('p')
      .where('p.deletedAt IS NULL')
      .andWhere('p.customerId IN (:...ids)', { ids });
    if (!isAdmin) {
      payQb.andWhere('p.createdById = :uid', { uid: user.id });
    }
    const payments = await payQb.getMany();

    const byCustomerInv = new Map<string, Invoice[]>();
    for (const inv of invoices) {
      const list = byCustomerInv.get(inv.customerId) ?? [];
      list.push(inv);
      byCustomerInv.set(inv.customerId, list);
    }
    const byCustomerPay = new Map<string, CustomerPayment[]>();
    for (const p of payments) {
      const list = byCustomerPay.get(p.customerId) ?? [];
      list.push(p);
      byCustomerPay.set(p.customerId, list);
    }

    return {
      data: customers.map((c) => {
        const summary = this.summarize(
          byCustomerInv.get(c.id) ?? [],
          byCustomerPay.get(c.id) ?? [],
        );
        const createdBy = c.createdBy
          ? {
              email: c.createdBy.email,
              userInfo: c.createdBy.userInfo
                ? { fullName: c.createdBy.userInfo.fullName }
                : null,
            }
          : null;
        const loc = locationNames(c);
        return {
          id: c.id,
          name: c.name,
          primaryPhone: c.primaryPhone,
          primaryEmail: c.primaryEmail,
          gstin: c.gstin,
          city: loc.city,
          state: loc.state,
          createdBy,
          ...summary,
        };
      }),
    };
  }

  async customerLedger(
    customerId: string,
    query: LedgerDetailQueryDto,
    user: AuthUser,
  ) {
    const customer = await this.getCustomerOrThrow(customerId, user);
    const invoices = await this.loadInvoices(customerId, user);
    const payments = await this.loadPayments(customerId, user);
    const summary = this.summarize(invoices, payments);
    const ledger = this.buildLedgerRows(invoices, payments, query);
    const loc = locationNames(customer);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        primaryPhone: customer.primaryPhone,
        secondaryPhone: customer.secondaryPhone,
        primaryEmail: customer.primaryEmail,
        address: customer.address,
        city: loc.city,
        state: loc.state,
        pincode: customer.pincode,
        gstin: customer.gstin,
        panNumber: customer.panNumber,
      },
      summary,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        billDate: inv.billDate,
        totalAmount: money(Number(inv.totalAmount)),
        amountPaid: money(Number(inv.amountPaid || 0)),
        balanceDue: money(remainingDue(inv)),
        paymentStatus: paymentStatusOf(inv),
        status: inv.status,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        paymentDate: p.paymentDate,
        amount: money(Number(p.amount)),
        mode: p.mode,
        referenceNo: p.referenceNo,
        notes: p.notes,
        allocations: (p.allocations ?? []).map((a) => ({
          invoiceId: a.invoiceId,
          amount: money(Number(a.amount)),
        })),
      })),
      ledger,
    };
  }

  async statement(customerId: string, user: AuthUser) {
    return this.customerLedger(customerId, {}, user);
  }

  private async applyPaidToInvoice(invoice: Invoice, delta: number) {
    const nextPaid = round2(Number(invoice.amountPaid || 0) + delta);
    if (nextPaid < -0.001) {
      throw new BadRequestException('Invoice paid amount cannot go negative');
    }
    const total = Number(invoice.totalAmount || 0);
    invoice.amountPaid = money(Math.max(0, nextPaid));
    if (nextPaid + 0.001 >= total && invoice.status !== InvoiceStatus.CANCELLED) {
      invoice.status = InvoiceStatus.PAID;
    } else if (invoice.status === InvoiceStatus.PAID && nextPaid + 0.001 < total) {
      invoice.status = InvoiceStatus.ISSUED;
    }
    await this.invoicesRepo.save(invoice);
  }

  private async fifoAllocations(
    customerId: string,
    amount: number,
    user: AuthUser,
  ): Promise<Array<{ invoiceId: string; amount: number }>> {
    const invoices = await this.loadInvoices(customerId, user);
    const open = invoices
      .filter((i) => remainingDue(i) > 0.001)
      .sort((a, b) => {
        const da = (a.billDate || '').localeCompare(b.billDate || '');
        if (da !== 0) return da;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    let left = round2(amount);
    const out: Array<{ invoiceId: string; amount: number }> = [];
    for (const inv of open) {
      if (left <= 0.001) break;
      const due = remainingDue(inv);
      const take = round2(Math.min(due, left));
      if (take <= 0) continue;
      out.push({ invoiceId: inv.id, amount: take });
      left = round2(left - take);
    }
    return out;
  }

  async createPayment(dto: CreatePaymentDto, user: AuthUser) {
    await this.getCustomerOrThrow(dto.customerId, user);
    const amount = round2(dto.amount);
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    let allocations = (dto.allocations ?? [])
      .map((a) => ({
        invoiceId: a.invoiceId,
        amount: round2(a.amount),
      }))
      .filter((a) => a.amount > 0);

    if (!allocations.length) {
      allocations = await this.fifoAllocations(dto.customerId, amount, user);
    }

    const allocSum = round2(allocations.reduce((s, a) => s + a.amount, 0));
    if (allocSum - amount > 0.01) {
      throw new BadRequestException(
        'Allocation total cannot exceed payment amount',
      );
    }

    if (allocations.length) {
      const invIds = allocations.map((a) => a.invoiceId);
      const invoices = await this.invoicesRepo.find({
        where: {
          id: In(invIds),
          customerId: dto.customerId,
        },
      });
      if (invoices.length !== invIds.length) {
        throw new BadRequestException('One or more invoices not found');
      }
      const byId = new Map(invoices.map((i) => [i.id, i]));
      for (const a of allocations) {
        const inv = byId.get(a.invoiceId)!;
        if (
          inv.status === InvoiceStatus.CANCELLED ||
          inv.status === InvoiceStatus.DRAFT
        ) {
          throw new BadRequestException(
            `Invoice ${inv.invoiceNumber} cannot receive payments`,
          );
        }
        if (user.role !== Role.ADMIN && inv.createdById !== user.id) {
          throw new BadRequestException('Invoice not found');
        }
        const due = remainingDue(inv);
        if (a.amount - due > 0.01) {
          throw new BadRequestException(
            `Allocation for ${inv.invoiceNumber} exceeds balance due (${money(due)})`,
          );
        }
      }
    }

    const payment = await this.paymentsRepo.save(
      this.paymentsRepo.create({
        customerId: dto.customerId,
        paymentDate: dto.paymentDate.slice(0, 10),
        amount: money(amount),
        mode: dto.mode,
        referenceNo: dto.referenceNo?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdById: user.id,
      }),
    );

    for (const a of allocations) {
      await this.allocationsRepo.save(
        this.allocationsRepo.create({
          paymentId: payment.id,
          invoiceId: a.invoiceId,
          amount: money(a.amount),
        }),
      );
      const inv = await this.invoicesRepo.findOne({
        where: { id: a.invoiceId },
      });
      if (inv) await this.applyPaidToInvoice(inv, a.amount);
    }

    return this.customerLedger(dto.customerId, {}, user);
  }

  async removePayment(paymentId: string, user: AuthUser) {
    const payment = await this.paymentsRepo.findOne({
      where: { id: paymentId },
      relations: { allocations: true },
    });
    if (!payment || payment.deletedAt) {
      throw new NotFoundException('Payment not found');
    }
    if (user.role !== Role.ADMIN && payment.createdById !== user.id) {
      throw new NotFoundException('Payment not found');
    }

    for (const a of payment.allocations ?? []) {
      const inv = await this.invoicesRepo.findOne({
        where: { id: a.invoiceId },
      });
      if (inv) await this.applyPaidToInvoice(inv, -Number(a.amount));
    }

    await this.allocationsRepo.delete({ paymentId: payment.id });
    await this.paymentsRepo.softDelete(payment.id);

    return this.customerLedger(payment.customerId, {}, user);
  }
}
