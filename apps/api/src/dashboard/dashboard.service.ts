import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BookingType,
  ConsignmentStatus,
  InvoiceStatus,
  Role,
} from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Consignment } from '../entities/consignment.entity';
import { CustomerPayment } from '../entities/customer-payment.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import { User } from '../entities/user.entity';

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function money(n: number) {
  return Number(n || 0).toFixed(2);
}

/** Normalize PG date / Date / string to YYYY-MM-DD (local calendar). */
function toDateKey(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value);
  }
  const s = String(value);
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return isoDate(d);
  return s.slice(0, 10);
}

const bookingDayExpr = `COALESCE(c.bookingDate, CAST(c.createdAt AS date))`;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Consignment)
    private readonly consignmentsRepo: Repository<Consignment>,
    @InjectRepository(Invoice)
    private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(CustomerPayment)
    private readonly paymentsRepo: Repository<CustomerPayment>,
    @InjectRepository(Customer)
    private readonly customersRepo: Repository<Customer>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  private scopeUserId(user: AuthUser) {
    return user.role === Role.ADMIN ? null : user.id;
  }

  async overview(user: AuthUser) {
    const scopeId = this.scopeUserId(user);
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = startOfMonth(now);
    const monthStartIso = isoDate(monthStart);
    const todayIso = isoDate(today);
    const last14 = isoDate(addDays(today, -13));

    const bookingBase = this.consignmentsRepo
      .createQueryBuilder('c')
      .where('c.deletedAt IS NULL');
    if (scopeId) bookingBase.andWhere('c.createdById = :uid', { uid: scopeId });

    const invoiceBase = this.invoicesRepo
      .createQueryBuilder('i')
      .where('i.deletedAt IS NULL')
      .andWhere('i.status != :cancelled', {
        cancelled: InvoiceStatus.CANCELLED,
      });
    if (scopeId) invoiceBase.andWhere('i.createdById = :uid', { uid: scopeId });

    const paymentBase = this.paymentsRepo
      .createQueryBuilder('p')
      .where('p.deletedAt IS NULL');
    if (scopeId) paymentBase.andWhere('p.createdById = :uid', { uid: scopeId });

    const customerBase = this.customersRepo
      .createQueryBuilder('cu')
      .where('cu.deletedAt IS NULL')
      .andWhere('cu.isActive = true');
    if (scopeId) customerBase.andWhere('cu.createdById = :uid', { uid: scopeId });

    const [
      totalBookings,
      bookingsToday,
      bookingsMonth,
      accountMonth,
      cashMonth,
      inTransit,
      ofd,
      delivered,
      customersCount,
      invoicesMonthCount,
      invoicesMonthAmount,
      paymentsMonthAmount,
      outstandingRow,
    ] = await Promise.all([
      bookingBase.clone().getCount(),
      bookingBase
        .clone()
        .andWhere(`${bookingDayExpr} = :todayIso`, { todayIso })
        .getCount(),
      bookingBase
        .clone()
        .andWhere(`${bookingDayExpr} >= :monthStartIso`, { monthStartIso })
        .getCount(),
      bookingBase
        .clone()
        .andWhere(`${bookingDayExpr} >= :monthStartIso`, { monthStartIso })
        .andWhere('c.bookingType = :t', { t: BookingType.ACCOUNT })
        .getCount(),
      bookingBase
        .clone()
        .andWhere(`${bookingDayExpr} >= :monthStartIso`, { monthStartIso })
        .andWhere('c.bookingType = :t', { t: BookingType.CASH })
        .getCount(),
      bookingBase
        .clone()
        .andWhere('c.status = :s', { s: ConsignmentStatus.IN_TRANSIT })
        .getCount(),
      bookingBase
        .clone()
        .andWhere('c.status = :s', { s: ConsignmentStatus.OUT_FOR_DELIVERY })
        .getCount(),
      bookingBase
        .clone()
        .andWhere('c.status = :s', { s: ConsignmentStatus.DELIVERED })
        .getCount(),
      customerBase.getCount(),
      invoiceBase
        .clone()
        .andWhere('COALESCE(i.billDate, CAST(i.createdAt AS date)) >= :ms', {
          ms: monthStartIso,
        })
        .getCount(),
      invoiceBase
        .clone()
        .select('COALESCE(SUM(i.totalAmount), 0)', 'sum')
        .andWhere('COALESCE(i.billDate, CAST(i.createdAt AS date)) >= :ms', {
          ms: monthStartIso,
        })
        .getRawOne()
        .then((r) => Number(r?.sum || 0)),
      paymentBase
        .clone()
        .select('COALESCE(SUM(p.amount), 0)', 'sum')
        .andWhere('p.paymentDate >= :ms', { ms: monthStartIso })
        .getRawOne()
        .then((r) => Number(r?.sum || 0)),
      invoiceBase
        .clone()
        .select(
          'COALESCE(SUM(GREATEST(i.totalAmount - COALESCE(i.amountPaid, 0), 0)), 0)',
          'sum',
        )
        .andWhere('i.status IN (:...st)', {
          st: [InvoiceStatus.ISSUED, InvoiceStatus.PAID],
        })
        .getRawOne()
        .then((r) => Number(r?.sum || 0)),
    ]);

    // Bookings last 14 days (by bookingDate fallback createdAt)
    const bookingsDailyRaw = await bookingBase
      .clone()
      .select(`to_char(${bookingDayExpr}, 'YYYY-MM-DD')`, 'day')
      .addSelect('COUNT(*)', 'count')
      .andWhere(`${bookingDayExpr} >= :from`, { from: last14 })
      .andWhere(`${bookingDayExpr} <= :to`, { to: todayIso })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    const dailyMap = new Map(
      bookingsDailyRaw.map((r) => [
        toDateKey(r.day),
        Number(r.count || 0),
      ]),
    );
    const bookingsLast14Days: Array<{ date: string; count: number }> = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = isoDate(addDays(today, -i));
      bookingsLast14Days.push({ date: d, count: dailyMap.get(d) || 0 });
    }

    // Status breakdown
    const statusRaw = await bookingBase
      .clone()
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.status')
      .getRawMany();
    const bookingsByStatus = statusRaw.map((r) => ({
      status: r.status as string,
      count: Number(r.count || 0),
    }));

    // Top billed customers this month
    const topBilledRaw = await invoiceBase
      .clone()
      .leftJoin('i.customer', 'customer')
      .select('i.customerId', 'customerId')
      .addSelect('customer.name', 'customerName')
      .addSelect('COALESCE(SUM(i.totalAmount), 0)', 'total')
      .addSelect('COUNT(*)', 'invoiceCount')
      .andWhere('COALESCE(i.billDate, CAST(i.createdAt AS date)) >= :ms', {
        ms: monthStartIso,
      })
      .groupBy('i.customerId')
      .addGroupBy('customer.name')
      .orderBy('total', 'DESC')
      .limit(8)
      .getRawMany();

    const topBilledCustomers = topBilledRaw.map((r) => ({
      customerId: r.customerId as string,
      customerName: (r.customerName as string) || '—',
      totalAmount: money(Number(r.total || 0)),
      invoiceCount: Number(r.invoiceCount || 0),
    }));

    // Revenue last 6 months
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixMonthsIso = isoDate(sixMonthsAgo);
    const revenueRaw = await invoiceBase
      .clone()
      .select(
        `to_char(COALESCE(i.billDate, CAST(i.createdAt AS date)), 'YYYY-MM')`,
        'month',
      )
      .addSelect('COALESCE(SUM(i.totalAmount), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .andWhere('COALESCE(i.billDate, CAST(i.createdAt AS date)) >= :from', {
        from: sixMonthsIso,
      })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    const revenueMap = new Map(
      revenueRaw.map((r) => [
        String(r.month),
        {
          total: Number(r.total || 0),
          count: Number(r.count || 0),
        },
      ]),
    );
    const billingLast6Months: Array<{
      month: string;
      label: string;
      totalAmount: string;
      invoiceCount: number;
    }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = revenueMap.get(key) || { total: 0, count: 0 };
      billingLast6Months.push({
        month: key,
        label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        totalAmount: money(row.total),
        invoiceCount: row.count,
      });
    }

    // Booking type mix (month)
    const bookingTypeMonth = [
      { type: 'ACCOUNT', label: 'Account', count: accountMonth },
      { type: 'CASH', label: 'Cash', count: cashMonth },
    ];

    let adminExtras: Record<string, unknown> | undefined;
    if (user.role === Role.ADMIN) {
      const usersActive = await this.usersRepo.count({
        where: { isActive: true },
      });
      const topUsersRaw = await this.consignmentsRepo
        .createQueryBuilder('c')
        .leftJoin('c.createdBy', 'u')
        .leftJoin('u.userInfo', 'info')
        .select('c.createdById', 'userId')
        .addSelect('COALESCE(info.fullName, u.email)', 'userName')
        .addSelect('COUNT(*)', 'count')
        .where('c.deletedAt IS NULL')
        .andWhere('c.createdAt >= :monthStart', { monthStart })
        .groupBy('c.createdById')
        .addGroupBy('info.fullName')
        .addGroupBy('u.email')
        .orderBy('count', 'DESC')
        .limit(8)
        .getRawMany();

      adminExtras = {
        activeUsers: usersActive,
        topUsersByBookings: topUsersRaw.map((r) => ({
          userId: r.userId as string,
          userName: (r.userName as string) || '—',
          count: Number(r.count || 0),
        })),
      };
    }

    return {
      role: user.role,
      period: {
        today: todayIso,
        monthStart: monthStartIso,
      },
      kpis: {
        totalBookings,
        bookingsToday,
        bookingsMonth,
        accountBookingsMonth: accountMonth,
        cashBookingsMonth: cashMonth,
        inTransit,
        outForDelivery: ofd,
        delivered,
        customersCount,
        invoicesMonthCount,
        invoicesMonthAmount: money(invoicesMonthAmount),
        paymentsMonthAmount: money(paymentsMonthAmount),
        outstandingAmount: money(outstandingRow),
      },
      charts: {
        bookingsLast14Days,
        bookingsByStatus,
        bookingTypeMonth,
        topBilledCustomers,
        billingLast6Months,
      },
      admin: adminExtras ?? null,
    };
  }
}
