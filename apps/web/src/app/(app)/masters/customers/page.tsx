'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { useState } from 'react';
import { ListPaginator, ListToolbar } from '@/components/ListControls';
import { api } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  pincode: string | null;
  gstin: string | null;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name Asc', sortBy: 'name', sortOrder: 'ASC' },
  { label: 'Name Desc', sortBy: 'name', sortOrder: 'DESC' },
  { label: 'City Asc', sortBy: 'city', sortOrder: 'ASC' },
  { label: 'City Desc', sortBy: 'city', sortOrder: 'DESC' },
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC' },
];

export default function CustomersPage() {
  const qc = useQueryClient();
  const list = useListParams({ defaultSort: SORT_OPTIONS[0] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    pincode: '',
    gstin: '',
    address: '',
  });

  const listQuery = useQuery({
    queryKey: ['customers', list.queryParams],
    queryFn: () => fetchPaginated<Customer>('/customers', list.queryParams),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/customers', {
        ...form,
        email: form.email || undefined,
      });
    },
    onSuccess: async () => {
      setOpen(false);
      setForm({
        name: '',
        phone: '',
        email: '',
        city: '',
        pincode: '',
        gstin: '',
        address: '',
      });
      await qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <Button label="Add customer" icon="pi pi-plus" onClick={() => setOpen(true)} />
      </div>
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search name / phone"
        sortKey={list.sortKey}
        onSortChange={list.setSortKey}
        sortOptions={SORT_OPTIONS}
      />
      <div className="panel">
        <DataTable value={listQuery.data?.data ?? []} loading={listQuery.isLoading}>
          <Column field="name" header="Name" />
          <Column field="phone" header="Phone" />
          <Column field="email" header="Email" />
          <Column field="city" header="City" />
          <Column field="pincode" header="Pincode" />
          <Column field="gstin" header="GSTIN" />
        </DataTable>
        <ListPaginator
          meta={meta}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </div>

      <Dialog header="New customer" visible={open} onHide={() => setOpen(false)} style={{ width: 520 }}>
        <div className="form-grid">
          {(['name', 'phone', 'email', 'city', 'pincode', 'gstin', 'address'] as const).map(
            (key) => (
              <div className={`field ${key === 'address' ? 'full' : ''}`} key={key}>
                <label>{key}</label>
                <InputText
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            ),
          )}
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Button label="Save" loading={createMutation.isPending} onClick={() => createMutation.mutate()} />
        </div>
      </Dialog>
    </div>
  );
}
