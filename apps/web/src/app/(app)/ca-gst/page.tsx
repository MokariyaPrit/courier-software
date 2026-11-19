'use client';

import { useQuery } from '@tanstack/react-query';
import { Button, DataTable, InputText, Select } from '@/components/ui';
import { useMemo, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { fetchPaginated } from '@/lib/list';

type GstRow = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  billDate: string | null;
  customerName: string;
  customerGstin: string | null;
  customerPan: string | null;
  customerState: string | null;
  issuerName: string;
  issuerGstin: string | null;
  issuerPan: string | null;
  hsnSac: string;
  taxableValue: string;
  cgstPercent: string;
  cgstAmount: string;
  sgstPercent: string;
  sgstAmount: string;
  igstPercent: string;
  igstAmount: string;
  roundOffAmount: string;
  invoiceValue: string;
};

type CustomerSummary = {
  id: string;
  customerId: string;
  customerName: string;
  customerGstin: string | null;
  customerPan: string | null;
  customerState: string | null;
  invoiceCount: number;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  roundOffAmount: string;
  invoiceValue: string;
};

type CaGstReport = {
  meta: {
    dateFrom: string;
    dateTo: string;
    generatedAt: string;
    hsnSac: string;
    hsnDescription: string;
    scopedToOwnInvoices?: boolean;
  };
  issuer: {
    companyName: string;
    gstin: string | null;
    pan: string | null;
    state: string | null;
    multiIssuer?: boolean;
  };
  issuerSummary?: Array<{
    id: string;
    companyName: string;
    gstin: string | null;
    pan: string | null;
    invoiceCount: number;
  }>;
  rows: GstRow[];
  customerSummary: CustomerSummary[];
  totals: {
    invoiceCount: number;
    customerCount: number;
    issuerCount?: number;
    taxableValue: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    roundOffAmount: string;
    invoiceValue: string;
  };
};

function firstOfMonthIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const raw = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }
  return raw;
}

function money(value: string | number | null | undefined) {
  return Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function csvEscape(value: string | number | null | undefined) {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ALL_CUSTOMERS = '__all__';

/** PrimeReact can return '' / null / option object — normalize to id string or ''. */
function normalizeCustomerId(value: unknown): string {
  if (value == null || value === '' || value === ALL_CUSTOMERS) return '';
  if (typeof value === 'string') {
    if (value === '[object Object]' || value === ALL_CUSTOMERS) return '';
    return value;
  }
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return normalizeCustomerId((value as { value: unknown }).value);
  }
  return '';
}

export default function CaGstPage() {
  const [dateFrom, setDateFrom] = useState(firstOfMonthIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [customerId, setCustomerId] = useState<string>(ALL_CUSTOMERS);
  const [applied, setApplied] = useState({
    dateFrom: firstOfMonthIso(),
    dateTo: todayIso(),
    customerId: '',
  });
  const [tab, setTab] = useState<'invoices' | 'customers'>('invoices');

  const customersQuery = useQuery({
    queryKey: ['customers-ca-gst'],
    queryFn: () =>
      fetchPaginated<{ id: string; name: string }>('/customers', {
        page: 1,
        pageSize: 500,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
  });

  const reportQuery = useQuery({
    queryKey: ['ca-gst-report', applied],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
      });
      const cid = normalizeCustomerId(applied.customerId);
      if (cid) params.set('customerId', cid);
      const res = await api.get(`/gst-reports/ca?${params.toString()}`);
      return unwrap<CaGstReport>(res.data);
    },
  });

  const report = reportQuery.data;
  const customerOptions = useMemo(
    () => [
      { label: 'All parties', value: ALL_CUSTOMERS },
      ...(customersQuery.data?.data ?? []).map((c) => ({
        label: c.name,
        value: c.id,
      })),
    ],
    [customersQuery.data?.data],
  );

  const exportInvoiceCsv = () => {
    if (!report) return;
    downloadCsv(
      `CA-GST-Invoices-${report.meta.dateFrom}_to_${report.meta.dateTo}.csv`,
      [
        'Invoice No',
        'Bill Date',
        'Branch Manager',
        'Issuer GSTIN',
        'Party',
        'Party GSTIN',
        'Party PAN',
        'State',
        'HSN/SAC',
        'Taxable Value',
        'CGST %',
        'CGST Amount',
        'SGST %',
        'SGST Amount',
        'IGST %',
        'IGST Amount',
        'Round Off',
        'Invoice Value',
      ],
      report.rows.map((r) => [
        r.invoiceNumber,
        formatDate(r.billDate),
        r.issuerName || '',
        r.issuerGstin || '',
        r.customerName,
        r.customerGstin || '',
        r.customerPan || '',
        r.customerState || '',
        r.hsnSac,
        r.taxableValue,
        r.cgstPercent,
        r.cgstAmount,
        r.sgstPercent,
        r.sgstAmount,
        r.igstPercent,
        r.igstAmount,
        r.roundOffAmount,
        r.invoiceValue,
      ]),
    );
  };

  const exportCustomerCsv = () => {
    if (!report) return;
    downloadCsv(
      `CA-GST-Parties-${report.meta.dateFrom}_to_${report.meta.dateTo}.csv`,
      [
        'Party',
        'GSTIN',
        'PAN',
        'State',
        'Invoice Count',
        'Taxable Value',
        'CGST',
        'SGST',
        'IGST',
        'Round Off',
        'Invoice Value',
      ],
      report.customerSummary.map((c) => [
        c.customerName,
        c.customerGstin || '',
        c.customerPan || '',
        c.customerState || '',
        String(c.invoiceCount),
        c.taxableValue,
        c.cgstAmount,
        c.sgstAmount,
        c.igstAmount,
        c.roundOffAmount,
        c.invoiceValue,
      ]),
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>CA GST report</h1>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Party bill GST data for CA — income tax &amp; GST return filing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            label="Export invoices CSV"
            icon="pi pi-download"
            outlined
            disabled={!report?.rows.length}
            onClick={exportInvoiceCsv}
          />
          <Button
            label="Export parties CSV"
            icon="pi pi-download"
            outlined
            disabled={!report?.customerSummary.length}
            onClick={exportCustomerCsv}
          />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="caDateFrom">From (bill date)</label>
            <InputText
              id="caDateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label htmlFor="caDateTo">To (bill date)</label>
            <InputText
              id="caDateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Party</label>
            <Select
              value={customerId || ALL_CUSTOMERS}
              options={customerOptions}
              onChange={(e) => {
                const next = normalizeCustomerId(e.value);
                setCustomerId(next || ALL_CUSTOMERS);
              }}
              placeholder="All parties"
              showClear={customerId !== ALL_CUSTOMERS && customerId !== ''}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button
              label="Load report"
              icon="pi pi-search"
              loading={reportQuery.isFetching}
              disabled={!dateFrom || !dateTo || dateFrom > dateTo}
              onClick={() =>
                setApplied({
                  dateFrom,
                  dateTo,
                  customerId: normalizeCustomerId(customerId),
                })
              }
            />
          </div>
        </div>
      </div>

      {report ? (
        <>
          <div className="panel ca-gst-summary">
            <div className="ca-gst-summary-grid">
              <div>
                <span className="muted">Issuer</span>
                <strong>{report.issuer.companyName}</strong>
                {report.issuer.multiIssuer ? (
                  <span className="muted">
                    {(report.issuerSummary ?? [])
                      .map((i) => i.companyName)
                      .join(' · ') || 'Bills from multiple users'}
                  </span>
                ) : (
                  <span className="muted">
                    GSTIN: {report.issuer.gstin || '—'} · PAN:{' '}
                    {report.issuer.pan || '—'}
                  </span>
                )}
              </div>
              <div>
                <span className="muted">Period</span>
                <strong>
                  {formatDate(report.meta.dateFrom)} –{' '}
                  {formatDate(report.meta.dateTo)}
                </strong>
                <span className="muted">
                  HSN {report.meta.hsnSac} · {report.meta.hsnDescription}
                </span>
              </div>
              <div>
                <span className="muted">Invoices</span>
                <strong>{report.totals.invoiceCount}</strong>
                <span className="muted">
                  {report.totals.customerCount} part
                  {report.totals.customerCount === 1 ? 'y' : 'ies'}
                </span>
              </div>
              <div>
                <span className="muted">Taxable value</span>
                <strong>{money(report.totals.taxableValue)}</strong>
              </div>
              <div>
                <span className="muted">CGST</span>
                <strong>{money(report.totals.cgstAmount)}</strong>
              </div>
              <div>
                <span className="muted">SGST</span>
                <strong>{money(report.totals.sgstAmount)}</strong>
              </div>
              <div>
                <span className="muted">IGST</span>
                <strong>{money(report.totals.igstAmount)}</strong>
              </div>
              <div>
                <span className="muted">Invoice value</span>
                <strong>{money(report.totals.invoiceValue)}</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="ca-gst-tabs">
              <Button
                label="Invoice-wise"
                text={tab !== 'invoices'}
                onClick={() => setTab('invoices')}
              />
              <Button
                label="Party-wise"
                text={tab !== 'customers'}
                onClick={() => setTab('customers')}
              />
            </div>

            {tab === 'invoices' ? (
              <DataTable
                value={report.rows}
                dataKey="id"
                loading={reportQuery.isFetching}
                columns={[
                  { field: 'invoiceNumber', header: 'Invoice No' },
                  {
                    header: 'Bill date',
                    body: (row: GstRow) => formatDate(row.billDate),
                  },
                  {
                    header: 'Branch Manager',
                    body: (row: GstRow) => row.issuerName || '—',
                  },
                  { field: 'customerName', header: 'Party' },
                  {
                    header: 'GSTIN',
                    body: (row: GstRow) => row.customerGstin || '—',
                  },
                  { field: 'hsnSac', header: 'HSN' },
                  {
                    header: 'Taxable',
                    body: (row: GstRow) => money(row.taxableValue),
                  },
                  {
                    header: 'CGST',
                    body: (row: GstRow) => money(row.cgstAmount),
                  },
                  {
                    header: 'SGST',
                    body: (row: GstRow) => money(row.sgstAmount),
                  },
                  {
                    header: 'IGST',
                    body: (row: GstRow) => money(row.igstAmount),
                  },
                  {
                    header: 'Total',
                    body: (row: GstRow) => money(row.invoiceValue),
                  },
                ]}
              />
            ) : (
              <DataTable
                value={report.customerSummary}
                dataKey="id"
                loading={reportQuery.isFetching}
                columns={[
                  { field: 'customerName', header: 'Party' },
                  {
                    header: 'GSTIN',
                    body: (row: CustomerSummary) => row.customerGstin || '—',
                  },
                  {
                    header: 'PAN',
                    body: (row: CustomerSummary) => row.customerPan || '—',
                  },
                  {
                    header: 'State',
                    body: (row: CustomerSummary) => row.customerState || '—',
                  },
                  { field: 'invoiceCount', header: 'Bills' },
                  {
                    header: 'Taxable',
                    body: (row: CustomerSummary) => money(row.taxableValue),
                  },
                  {
                    header: 'CGST',
                    body: (row: CustomerSummary) => money(row.cgstAmount),
                  },
                  {
                    header: 'SGST',
                    body: (row: CustomerSummary) => money(row.sgstAmount),
                  },
                  {
                    header: 'IGST',
                    body: (row: CustomerSummary) => money(row.igstAmount),
                  },
                  {
                    header: 'Total',
                    body: (row: CustomerSummary) => money(row.invoiceValue),
                  },
                ]}
              />
            )}
          </div>
        </>
      ) : reportQuery.isLoading ? (
        <p className="muted">Loading GST report…</p>
      ) : reportQuery.isError ? (
        <p className="error-text">Failed to load GST report.</p>
      ) : null}
    </div>
  );
}
