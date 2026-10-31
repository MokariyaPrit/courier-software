'use client';

import { QuotationStatus } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
  Dialog,
  Select,
  Tag,
  type AppColumn,
} from '@/components/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ListFilterChrome, ListSearch } from '@/components/ListControls';
import { api, unwrap } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';

interface QuotationRow {
  id: string;
  quotationCode: string | null;
  quotationDate: string;
  status: QuotationStatus;
  customer?: { name: string } | null;
  template?: { name: string } | null;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC', isDefault: true },
  { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { label: 'Date Asc', sortBy: 'quotationDate', sortOrder: 'ASC' },
  { label: 'Date Desc', sortBy: 'quotationDate', sortOrder: 'DESC' },
  { label: 'Code Asc', sortBy: 'quotationCode', sortOrder: 'ASC' },
  { label: 'Status Asc', sortBy: 'status', sortOrder: 'ASC' },
];

export default function QuotationsPage() {
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState('');

  const listQuery = useQuery({
    queryKey: ['quotations', list.queryParams],
    queryFn: () => fetchPaginated<QuotationRow>('/quotations', list.queryParams),
  });

  const customersQuery = useQuery({
    queryKey: ['customers-quotations'],
    queryFn: () =>
      fetchPaginated<{ id: string; name: string }>('/customers', {
        page: 1,
        pageSize: 200,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
  });

  const templatesQuery = useQuery({
    queryKey: ['templates-quotations'],
    queryFn: () =>
      fetchPaginated<{ id: string; name: string; isActive: boolean }>(
        '/quotation-templates',
        { page: 1, pageSize: 200, sortBy: 'name', sortOrder: 'ASC' },
      ),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/quotations', {
        customerId,
        templateId: templateId || undefined,
      });
      return unwrap<{ id: string }>(res.data);
    },
    onSuccess: async (created) => {
      setOpen(false);
      setCustomerId('');
      setTemplateId('');
      setError('');
      await qc.invalidateQueries({ queryKey: ['quotations'] });
      window.location.href = `/quotations/${created.id}`;
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to create quotation';
      setError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/quotations/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['quotations'] });
    },
  });

  const askDelete = (row: QuotationRow) => {
    confirmDialog({
      header: 'Delete quotation',
      message: `Delete draft quotation for "${row.customer?.name || 'client'}"?`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row.id),
    });
  };

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  const tableColumns = useMemo((): AppColumn<QuotationRow>[] => {
    return [
      {
        header: 'Code',
        body: (row) => row.quotationCode || '—',
      },
      {
        header: 'Customer',
        body: (row) => row.customer?.name || '—',
      },
      {
        header: 'Template',
        body: (row) => row.template?.name || '—',
      },
      { field: 'quotationDate', header: 'Date' },
      {
        header: 'Status',
        body: (row) => (
          <Tag severity={row.status === QuotationStatus.ISSUED ? 'success' : 'info'}>
            {row.status}
          </Tag>
        ),
      },
      {
        header: 'Actions',
        body: (row) => (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <Link href={`/quotations/${row.id}`}>
              <Button size="small" text icon="pi pi-eye" label="Open" />
            </Link>
            {row.status === QuotationStatus.DRAFT ? (
              <Button
                size="small"
                text
                severity="danger"
                icon="pi pi-trash"
                label="Delete"
                onClick={() => askDelete(row)}
              />
            ) : null}
          </div>
        ),
      },
    ];
  }, []);

  const templateOptions = (templatesQuery.data?.data ?? [])
    .filter((t) => t.isActive)
    .map((t) => ({ label: t.name, value: t.id }));

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Quotations</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/quotations/templates">
            <Button label="Rate templates" severity="secondary" outlined />
          </Link>
          <Button
            label="New quotation"
            icon="pi pi-plus"
            onClick={() => {
              setError('');
              setOpen(true);
            }}
          />
        </div>
      </div>
      <ListSearch
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search code / customer"
      />
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
            value={listQuery.data?.data ?? []}
            loading={listQuery.isLoading}
            columns={tableColumns}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header="New quotation"
        visible={open}
        onHide={() => setOpen(false)}
        style={{ width: 'min(480px, 95vw)' }}
      >
        <div className="form-grid">
          <div className="field full">
            <label>Customer</label>
            <Select
              value={customerId || null}
              options={(customersQuery.data?.data ?? []).map((c) => ({
                label: c.name,
                value: c.id,
              }))}
              onChange={(e) => setCustomerId(String(e.value || ''))}
              placeholder="Select customer"
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Rate template</label>
            <Select
              value={templateId || null}
              options={templateOptions}
              onChange={(e) => setTemplateId(String(e.value || ''))}
              placeholder="Select template"
              style={{ width: '100%' }}
            />
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
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
            onClick={() => setOpen(false)}
          />
          <Button
            label="Create draft"
            loading={createMutation.isPending}
            disabled={!customerId || !templateId}
            onClick={() => createMutation.mutate()}
          />
        </div>
      </Dialog>
    </div>
  );
}
