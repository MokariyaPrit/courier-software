'use client';

import { Role } from '@courier/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  DonutChart,
  HBarChart,
  LineAreaChart,
} from '@/components/dashboard/charts';
import { useAuth } from '@/lib/auth';
import { api, unwrap } from '@/lib/api';

type Overview = {
  role: Role;
  period: { today: string; monthStart: string };
  kpis: {
    totalBookings: number;
    bookingsToday: number;
    bookingsMonth: number;
    accountBookingsMonth: number;
    cashBookingsMonth: number;
    inTransit: number;
    outForDelivery: number;
    delivered: number;
    customersCount: number;
    invoicesMonthCount: number;
    invoicesMonthAmount: string;
    paymentsMonthAmount: string;
    outstandingAmount: string;
  };
  charts: {
    bookingsLast14Days: Array<{ date: string; count: number }>;
    bookingsByStatus: Array<{ status: string; count: number }>;
    bookingTypeMonth: Array<{ type: string; label: string; count: number }>;
    topBilledCustomers: Array<{
      customerId: string;
      customerName: string;
      totalAmount: string;
      invoiceCount: number;
    }>;
    billingLast6Months: Array<{
      month: string;
      label: string;
      totalAmount: string;
      invoiceCount: number;
    }>;
  };
  admin: {
    activeUsers: number;
    topUsersByBookings: Array<{
      userId: string;
      userName: string;
      count: number;
    }>;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  BOOKED: '#3b82f6',
  IN_TRANSIT: '#8b5cf6',
  AT_HUB: '#06b6d4',
  OUT_FOR_DELIVERY: '#f59e0b',
  DELIVERED: '#10b981',
  RTO: '#ef4444',
  CANCELLED: '#6b7280',
  FAILED_ATTEMPT: '#f97316',
};

function Kpi({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {hint ? <span className="dash-kpi-hint muted">{hint}</span> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="dash-kpi">
        {inner}
      </Link>
    );
  }
  return <div className="dash-kpi">{inner}</div>;
}

function shortDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === Role.ADMIN;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-overview', user?.role],
    enabled: Boolean(user),
    queryFn: async () => {
      const res = await api.get('/dashboard/overview');
      return unwrap<Overview>(res.data);
    },
  });

  if (isLoading || !user) {
    return (
      <div>
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>
        <p className="muted">Loading overview…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div>
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>
        <p className="error-text">Could not load dashboard.</p>
      </div>
    );
  }

  const { kpis, charts, admin } = data;
  const title = isAdmin ? 'Admin dashboard' : 'Branch dashboard';
  const subtitle = isAdmin
    ? 'Company-wide bookings, billing, and collections'
    : 'Your bookings, bills, and collections this month';

  return (
    <div className="dash-page">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {subtitle}
          </p>
        </div>
        <div className="dash-quick no-print">
          <Link href="/bookings/account" className="dash-quick-link">
            Account booking
          </Link>
          <Link href="/bookings/cash" className="dash-quick-link">
            Cash booking
          </Link>
          <Link href="/billing" className="dash-quick-link">
            Generate bill
          </Link>
          <Link href="/customer-ledger" className="dash-quick-link">
            Ledger
          </Link>
        </div>
      </div>

      <div className="dash-kpi-grid">
        <Kpi
          label="Bookings today"
          value={kpis.bookingsToday}
          href="/bookings/account"
        />
        <Kpi
          label="Bookings this month"
          value={kpis.bookingsMonth}
          hint={`${kpis.accountBookingsMonth} account · ${kpis.cashBookingsMonth} cash`}
        />
        <Kpi label="Total bookings" value={kpis.totalBookings} href="/tracking" />
        <Kpi label="Parties" value={kpis.customersCount} href="/customers" />
        <Kpi
          label="Billed this month"
          value={`₹${Number(kpis.invoicesMonthAmount).toLocaleString('en-IN')}`}
          hint={`${kpis.invoicesMonthCount} invoices`}
          href="/billing/invoices"
        />
        <Kpi
          label="Collected this month"
          value={`₹${Number(kpis.paymentsMonthAmount).toLocaleString('en-IN')}`}
          href="/customer-ledger"
        />
        <Kpi
          label="Outstanding"
          value={`₹${Number(kpis.outstandingAmount).toLocaleString('en-IN')}`}
          href="/customer-ledger"
        />
        <Kpi label="In transit" value={kpis.inTransit} href="/delivery" />
        <Kpi label="Out for delivery" value={kpis.outForDelivery} href="/delivery" />
        <Kpi label="Delivered" value={kpis.delivered} />
        {isAdmin && admin ? (
          <Kpi label="Active users" value={admin.activeUsers} href="/admin/users" />
        ) : null}
      </div>

      <div className="dash-grid">
        <section className="panel dash-card">
          <h2>Bookings · last 14 days</h2>
          <LineAreaChart
            items={charts.bookingsLast14Days.map((d) => ({
              label: shortDay(d.date),
              value: d.count,
            }))}
          />
          <div className="dash-day-strip">
            {charts.bookingsLast14Days.map((d) => (
              <div key={d.date} className="dash-day-pill">
                <span>{shortDay(d.date)}</span>
                <strong>{d.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel dash-card">
          <h2>Booking mix · this month</h2>
          <DonutChart
            items={charts.bookingTypeMonth.map((t) => ({
              label: t.label,
              value: t.count,
              color: t.type === 'ACCOUNT' ? '#0f766e' : '#d97706',
            }))}
            emptyText="No bookings this month"
          />
        </section>

        <section className="panel dash-card">
          <h2>Status breakdown</h2>
          <DonutChart
            items={charts.bookingsByStatus.map((s) => ({
              label: s.status.replaceAll('_', ' '),
              value: s.count,
              color: STATUS_COLORS[s.status] || '#64748b',
            }))}
          />
        </section>

        <section className="panel dash-card dash-card-wide">
          <h2>Top billed parties · this month</h2>
          <HBarChart
            valuePrefix="₹"
            emptyText="No bills this month"
            items={charts.topBilledCustomers.map((c) => ({
              label: c.customerName,
              value: Number(c.totalAmount),
              hint: `${c.invoiceCount} inv`,
            }))}
          />
        </section>

        <section className="panel dash-card dash-card-wide">
          <h2>Billing · last 6 months</h2>
          <HBarChart
            valuePrefix="₹"
            items={charts.billingLast6Months.map((m) => ({
              label: m.label,
              value: Number(m.totalAmount),
              hint: `${m.invoiceCount} inv`,
            }))}
          />
        </section>

        {isAdmin && admin ? (
          <section className="panel dash-card dash-card-wide">
            <h2>Top users by bookings · this month</h2>
            <HBarChart
              emptyText="No bookings this month"
              items={admin.topUsersByBookings.map((u) => ({
                label: u.userName,
                value: u.count,
              }))}
            />
          </section>
        ) : (
          <section className="panel dash-card dash-card-wide">
            <h2>Your focus</h2>
            <div className="dash-focus">
              <Link href="/bookings/account">Account booking</Link>
              <Link href="/bookings/cash">Cash booking</Link>
              <Link href="/billing">Generate bill</Link>
              <Link href="/customer-ledger">Collect payment</Link>
              <Link href="/tracking">Booking list</Link>
              <Link href="/ca-gst">CA GST</Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
