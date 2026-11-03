'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
} from '@/components/ui';
import { useRouter } from 'next/navigation';
import { ListFilterChrome } from '@/components/ListControls';
import { api } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  status: string;
  billDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  customer?: { name: string };
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

  const invoicesQuery = useQuery({
    queryKey: ['invoices', list.queryParams],
    queryFn: () =>
      fetchPaginated<Invoice>('/billing/invoices', {
        page: list.page,
        pageSize: list.pageSize,
        sortBy: list.sort.sortBy,
        sortOrder: list.sort.sortOrder,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/billing/invoices/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoices'] });
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

  const meta = invoicesQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Invoices</h1>
        <Button
          label="Generate bill"
          icon="pi pi-plus"
          severity="secondary"
          outlined
          onClick={() => router.push('/billing')}
        />
      </div>
      <div className="panel">
        <ListFilterChrome
          meta={meta}
          sortOptions={SORT_OPTIONS}
          sortKey={list.sortKey}
          onSortChange={list.setSortKey}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          showClearFilters
          onClearFilters={list.clearFilters}
          clearFiltersDisabled={!list.hasActiveFilters}
        >
          <DataTable
            value={invoicesQuery.data?.data ?? []}
            loading={invoicesQuery.isLoading}
            columns={[
              { field: 'invoiceNumber', header: 'Bill No' },
              {
                header: 'Party',
                body: (row: Invoice) => row.customer?.name ?? '—',
              },
              {
                header: 'Bill date',
                body: (row: Invoice) => formatDate(row.billDate),
              },
              {
                header: 'Period',
                body: (row: Invoice) =>
                  row.periodStart && row.periodEnd
                    ? `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`
                    : '—',
              },
              {
                header: 'Bill amount',
                body: (row: Invoice) =>
                  Number(row.totalAmount || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
              },
              { field: 'status', header: 'Status' },
              {
                header: '',
                body: (row: Invoice) => (
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
            ]}
          />
        </ListFilterChrome>
      </div>
    </div>
  );
}
