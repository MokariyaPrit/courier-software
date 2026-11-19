'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
  type AppColumn,
} from '@/components/ui';
import { ListFilterChrome, ListSearch } from '@/components/ListControls';
import { api } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

type AnjaniListRow = {
  id: string;
  billNo: string | null;
  billDate: string | null;
  customerName: string | null;
  bill: string | null;
  editedPdfUrl?: string | null;
  editedPdfFileName?: string | null;
  createdAt: string;
};

const SORT_OPTIONS: SortOption[] = [
  {
    label: 'Newest first',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    isDefault: true,
  },
  { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { label: 'Bill No', sortBy: 'billNo', sortOrder: 'ASC' },
  { label: 'Customer', sortBy: 'customerName', sortOrder: 'ASC' },
];

export default function AnjaniBillListPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });

  const listQuery = useQuery({
    queryKey: ['anjani-bills', list.queryParams],
    queryFn: () =>
      fetchPaginated<AnjaniListRow>('/anjani-bills', list.queryParams),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/anjani-bills/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['anjani-bills'] });
    },
  });

  const columns = useMemo((): AppColumn<AnjaniListRow>[] => {
    return [
      {
        header: 'Bill No',
        body: (row) => row.billNo || '—',
      },
      {
        header: 'Date',
        body: (row) => row.billDate || '—',
      },
      {
        header: 'Customer',
        body: (row) => row.customerName || '—',
      },
      {
        header: 'Amount',
        body: (row) => row.bill || '—',
      },
      {
        header: '',
        body: (row) => (
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <Button
              label="Open"
              icon="pi pi-pencil"
              size="small"
              text
              onClick={() => router.push(`/edit-bill/anjani/${row.id}`)}
            />
            {row.editedPdfUrl ? (
              <Button
                label="PDF"
                icon="pi pi-download"
                size="small"
                text
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = row.editedPdfUrl!;
                  link.download =
                    row.editedPdfFileName ||
                    `${row.billNo || 'invoice'}.pdf`;
                  link.target = '_blank';
                  link.rel = 'noopener';
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                }}
              />
            ) : null}
            <Button
              label="Delete"
              icon="pi pi-trash"
              size="small"
              text
              severity="danger"
              loading={deleteMutation.isPending}
              onClick={() =>
                confirmDialog({
                  header: 'Delete bill',
                  message: `Delete bill ${row.billNo || row.id}? Files move to archive for 30 days.`,
                  acceptClassName: 'p-button-danger',
                  acceptLabel: 'Delete',
                  rejectLabel: 'Cancel',
                  accept: () => deleteMutation.mutate(row.id),
                })
              }
            />
          </div>
        ),
      },
    ];
  }, [deleteMutation, router]);

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <div>
          <h1>Shree Anjani Courier</h1>
          <p className="muted" style={{ margin: 0 }}>
            Upload an Anjani tax invoice PDF, edit weight/amount, save, and
            download.
          </p>
        </div>
        <Link href="/edit-bill/anjani/new">
          <Button label="New from PDF" icon="pi pi-plus" />
        </Link>
      </div>

      <div className="panel">
        <ListSearch
          search={list.search}
          onSearchChange={list.setSearch}
          searchPlaceholder="Search bill no or customer…"
        />
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
            value={listQuery.data?.data ?? []}
            loading={listQuery.isLoading}
            columns={columns}
          />
        </ListFilterChrome>
      </div>
    </div>
  );
}
