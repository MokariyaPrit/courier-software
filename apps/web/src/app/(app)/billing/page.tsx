'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DataTable,
  Dialog,
  InputText,
  MultiSelect,
  Select,
} from '@/components/ui';
import { useState } from 'react';
import { ListFilterChrome } from '@/components/ListControls';
import { api } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  customer?: { name: string };
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC', isDefault: true },
  { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { label: 'Invoice # Asc', sortBy: 'invoiceNumber', sortOrder: 'ASC' },
  { label: 'Invoice # Desc', sortBy: 'invoiceNumber', sortOrder: 'DESC' },
  { label: 'Amount Asc', sortBy: 'totalAmount', sortOrder: 'ASC' },
  { label: 'Amount Desc', sortBy: 'totalAmount', sortOrder: 'DESC' },
  { label: 'Status Asc', sortBy: 'status', sortOrder: 'ASC' },
];

export default function BillingPage() {
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [consignmentIds, setConsignmentIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

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

  const customersQuery = useQuery({
    queryKey: ['customers-billing'],
    queryFn: () =>
      fetchPaginated<{ id: string; name: string }>('/customers', {
        page: 1,
        pageSize: 200,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
  });

  const consignmentsQuery = useQuery({
    queryKey: ['consignments-billing'],
    queryFn: () =>
      fetchPaginated<{ id: string; awb: string; customerId: string | null }>(
        '/consignments',
        { page: 1, pageSize: 200, sortBy: 'createdAt', sortOrder: 'DESC' },
      ),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/billing/invoices', {
        customerId,
        consignmentIds,
        notes: notes || undefined,
      });
    },
    onSuccess: async () => {
      setOpen(false);
      setCustomerId('');
      setConsignmentIds([]);
      setNotes('');
      await qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const meta = invoicesQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
        <Button label="Create invoice" icon="pi pi-plus" onClick={() => setOpen(true)} />
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
              { field: 'invoiceNumber', header: 'Invoice #' },
              {
                header: 'Customer',
                body: (row: Invoice) => row.customer?.name ?? '—',
              },
              { field: 'totalAmount', header: 'Amount' },
              { field: 'status', header: 'Status' },
              {
                header: 'Created',
                body: (row: Invoice) => new Date(row.createdAt).toLocaleString(),
              },
            ]}
          />
        </ListFilterChrome>
      </div>

      <Dialog header="New invoice" visible={open} onHide={() => setOpen(false)} style={{ width: 560 }}>
        <div className="form-grid">
          <div className="field full">
            <label>Customer</label>
            <Select
              value={customerId}
              options={(customersQuery.data?.data ?? []).map((c) => ({
                label: c.name,
                value: c.id,
              }))}
              onChange={(e) => setCustomerId(e.value)}
              placeholder="Select customer"
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Consignments</label>
            <MultiSelect
              value={consignmentIds}
              options={(consignmentsQuery.data?.data ?? []).map((c) => ({
                label: c.awb,
                value: c.id,
              }))}
              onChange={(e) => setConsignmentIds(e.value)}
              placeholder="Select AWBs"
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Notes</label>
            <InputText
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Button
            label="Issue invoice"
            loading={createMutation.isPending}
            disabled={!customerId || consignmentIds.length === 0}
            onClick={() => createMutation.mutate()}
          />
        </div>
      </Dialog>
    </div>
  );
}
