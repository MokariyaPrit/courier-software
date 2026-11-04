'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
  Dialog,
  Textarea,
  type AppColumn,
} from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ListFilterChrome } from '@/components/ListControls';
import { api, unwrap } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import { apiErrorMessage } from '@/lib/toast';

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  status: string;
  billDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  lastEmailedAt?: string | null;
  customer?: { name: string; primaryEmail?: string | null };
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC', isDefault: true },
  { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { label: 'Bill date Desc', sortBy: 'billDate', sortOrder: 'DESC' },
  { label: 'Invoice # Asc', sortBy: 'invoiceNumber', sortOrder: 'ASC' },
  { label: 'Invoice # Desc', sortBy: 'invoiceNumber', sortOrder: 'DESC' },
  { label: 'Amount Asc', sortBy: 'totalAmount', sortOrder: 'ASC' },
  { label: 'Amount Desc', sortBy: 'totalAmount', sortOrder: 'DESC' },
  { label: 'Status Asc', sortBy: 'status', sortOrder: 'ASC' },
];

function firstOfMonthIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

export default function InvoicesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [dateFrom, setDateFrom] = useState(firstOfMonthIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [appliedFrom, setAppliedFrom] = useState(firstOfMonthIso);
  const [appliedTo, setAppliedTo] = useState(todayIso);
  const [selected, setSelected] = useState<Invoice[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState('');

  const invoicesQuery = useQuery({
    queryKey: [
      'invoices',
      list.page,
      list.pageSize,
      list.sort.sortBy,
      list.sort.sortOrder,
      appliedFrom,
      appliedTo,
    ],
    queryFn: () =>
      fetchPaginated<Invoice>('/billing/invoices', {
        page: list.page,
        pageSize: list.pageSize,
        sortBy: list.sort.sortBy,
        sortOrder: list.sort.sortOrder,
        dateFrom: appliedFrom || undefined,
        dateTo: appliedTo || undefined,
      }),
  });

  const rows = invoicesQuery.data?.data ?? [];
  const selectedIds = selected.map((row) => row.id);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/billing/invoices/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoices'] });
      setSelected([]);
    },
  });

  const bulkEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(
        '/billing/invoices/email-bulk',
        {
          ids: selectedIds,
          message: bulkMessage.trim() || undefined,
        },
        {
          toastSummary: 'Bulk email finished',
          toastDetail: 'See the summary for sent / failed invoices.',
        },
      );
      return unwrap<{
        sent: Array<{ id: string; invoiceNumber: string; to: string }>;
        failed: Array<{
          id: string;
          invoiceNumber?: string;
          reason: string;
        }>;
        meta: { requested: number; sent: number; failed: number };
      }>(res.data);
    },
    onSuccess: async (result) => {
      setBulkError('');
      setBulkResult(
        `Sent ${result.meta.sent} of ${result.meta.requested}` +
          (result.meta.failed
            ? ` · ${result.meta.failed} failed${
                result.failed[0]
                  ? ` (e.g. ${result.failed[0].invoiceNumber || result.failed[0].id}: ${result.failed[0].reason})`
                  : ''
              }`
            : ''),
      );
      setSelected([]);
      await qc.invalidateQueries({ queryKey: ['invoices'] });
      if (result.meta.failed === 0) {
        setBulkOpen(false);
      }
    },
    onError: (err: unknown) => {
      setBulkResult('');
      setBulkError(apiErrorMessage(err, 'Bulk email failed'));
    },
  });

  const askDelete = (row: Invoice) => {
    confirmDialog({
      header: 'Delete invoice',
      message: `Delete bill ${row.invoiceNumber}? Its bookings can be billed again.`,
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row.id),
    });
  };

  const applyDateRange = () => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setSelected([]);
    list.setPage(1);
  };

  const selectAllInRange = async () => {
    const res = await fetchPaginated<Invoice>('/billing/invoices', {
      page: 1,
      pageSize: 500,
      sortBy: list.sort.sortBy,
      sortOrder: list.sort.sortOrder,
      dateFrom: appliedFrom || undefined,
      dateTo: appliedTo || undefined,
    });
    setSelected(res.data);
  };

  const meta = invoicesQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  const columns = useMemo((): AppColumn<Invoice>[] => {
    return [
      { field: 'invoiceNumber', header: 'Bill No' },
      {
        header: 'Party',
        body: (row) => row.customer?.name ?? '—',
      },
      {
        header: 'Email',
        body: (row) => row.customer?.primaryEmail || '—',
      },
      {
        header: 'Bill date',
        body: (row) => formatDate(row.billDate),
      },
      {
        header: 'Period',
        body: (row) =>
          row.periodStart && row.periodEnd
            ? `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`
            : '—',
      },
      {
        header: 'Bill amount',
        body: (row) =>
          Number(row.totalAmount || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
      { field: 'status', header: 'Status' },
      {
        header: '',
        body: (row) => (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <Button
              label="View"
              icon="pi pi-eye"
              text
              size="small"
              onClick={() => router.push(`/billing/invoices/${row.id}`)}
            />
            <Button
              label="Delete"
              icon="pi pi-trash"
              text
              severity="danger"
              size="small"
              loading={deleteMutation.isPending}
              onClick={() => askDelete(row)}
            />
          </div>
        ),
      },
    ];
  }, [deleteMutation.isPending, router]);

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Invoices</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            label={`Send email (${selected.length})`}
            icon="pi pi-send"
            disabled={selected.length === 0}
            onClick={() => {
              setBulkError('');
              setBulkResult('');
              setBulkMessage('');
              setBulkOpen(true);
            }}
          />
          <Button
            label="Generate bill"
            icon="pi pi-plus"
            severity="secondary"
            outlined
            onClick={() => router.push('/billing')}
          />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div
          className="form-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            alignItems: 'end',
          }}
        >
          <div className="field">
            <label htmlFor="inv-date-from">Bill date from</label>
            <input
              id="inv-date-from"
              type="date"
              className="p-inputtext p-component"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label htmlFor="inv-date-to">Bill date to</label>
            <input
              id="inv-date-to"
              type="date"
              className="p-inputtext p-component"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field" style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              label="Apply range"
              icon="pi pi-filter"
              onClick={applyDateRange}
              disabled={!dateFrom || !dateTo || dateFrom > dateTo}
            />
            <Button
              label="Select all in range"
              icon="pi pi-check-square"
              outlined
              onClick={() => void selectAllInRange()}
            />
          </div>
        </div>
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
          Showing bills dated {formatDate(appliedFrom)} – {formatDate(appliedTo)}.
          Use the table checkboxes (header = select page) or Select all in range,
          then Send email.
        </p>
      </div>

      <div className="panel">
        <ListFilterChrome
          meta={meta}
          sortOptions={SORT_OPTIONS}
          sortKey={list.sortKey}
          onSortChange={(key) => {
            setSelected([]);
            list.setSortKey(key);
          }}
          onPageChange={(page) => {
            setSelected([]);
            list.setPage(page);
          }}
          onPageSizeChange={(size) => {
            setSelected([]);
            list.setPageSize(size);
          }}
          showClearFilters
          onClearFilters={list.clearFilters}
          clearFiltersDisabled={!list.hasActiveFilters}
        >
          <p className="muted" style={{ margin: '0 0 0.65rem', fontSize: '0.85rem' }}>
            {selected.length} selected
          </p>
          <DataTable
            value={rows}
            loading={invoicesQuery.isLoading}
            columns={columns}
            selection={selected}
            onSelectionChange={setSelected}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header={`Send ${selected.length} invoice email${selected.length === 1 ? '' : 's'}`}
        visible={bulkOpen}
        style={{ width: 'min(520px, 95vw)' }}
        onHide={() => setBulkOpen(false)}
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Each selected invoice is emailed to that party&apos;s primary email,
          using the document owner&apos;s Gmail. Invoices without an email are
          skipped and listed as failed.
        </p>
        <div className="field">
          <label htmlFor="bulk-msg">Message (optional, same for all)</label>
          <Textarea
            id="bulk-msg"
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.target.value)}
            rows={4}
            autoResize
            style={{ width: '100%' }}
          />
        </div>
        {bulkError ? <p className="error-text">{bulkError}</p> : null}
        {bulkResult ? <p className="muted">{bulkResult}</p> : null}
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <Button
            label="Cancel"
            severity="secondary"
            text
            onClick={() => setBulkOpen(false)}
          />
          <Button
            label="Send emails"
            icon="pi pi-send"
            loading={bulkEmailMutation.isPending}
            disabled={selected.length === 0}
            onClick={() => bulkEmailMutation.mutate()}
          />
        </div>
      </Dialog>
    </div>
  );
}
