'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
  Dialog,
  InputText,
  Select,
  Tag,
  ToggleSwitch,
  type AppColumn,
} from '@/components/ui';
import { useMemo, useState } from 'react';
import { ListFilterChrome, ListSearch } from '@/components/ListControls';
import { api, unwrap } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import { ownerDisplayName } from '@/lib/owner-display';
import { trimFormData } from '@/lib/trim';

interface Receiver {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cityId: string | null;
  stateId: string | null;
  pincode: string | null;
  notes: string | null;
  isActive: boolean;
  createdBy?: {
    email?: string | null;
    userInfo?: { fullName?: string | null } | null;
  } | null;
}

type Form = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  cityId: string;
  stateId: string;
  pincode: string;
  notes: string;
  isActive: boolean;
};

const EMPTY: Form = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  cityId: '',
  stateId: '',
  pincode: '',
  notes: '',
  isActive: true,
};

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name Asc', sortBy: 'name', sortOrder: 'ASC', isDefault: true },
  { label: 'Name Desc', sortBy: 'name', sortOrder: 'DESC' },
  { label: 'City Asc', sortBy: 'city', sortOrder: 'ASC' },
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC' },
];

export default function ReceiversPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState('');
  const isAdmin = user?.role === Role.ADMIN;

  const listQuery = useQuery({
    queryKey: ['receivers', list.queryParams],
    queryFn: () => fetchPaginated<Receiver>('/receivers', list.queryParams),
  });

  const statesQuery = useQuery({
    queryKey: ['states-receivers'],
    queryFn: () =>
      fetchPaginated<{ id: string; name: string }>('/states', {
        page: 1,
        pageSize: 500,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
    enabled: open,
  });

  const citiesQuery = useQuery({
    queryKey: ['cities-receivers', form.stateId],
    queryFn: () =>
      fetchPaginated<{ id: string; name: string; stateId?: string }>(
        '/cities',
        {
          page: 1,
          pageSize: 500,
          sortBy: 'name',
          sortOrder: 'ASC',
          ...(form.stateId ? { stateId: form.stateId } : {}),
        },
      ),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleaned = trimFormData(form);
      const payload = {
        name: cleaned.name,
        phone: cleaned.phone || null,
        email: cleaned.email || null,
        address: cleaned.address || null,
        cityId: cleaned.cityId || null,
        stateId: cleaned.stateId || null,
        pincode: cleaned.pincode || null,
        notes: cleaned.notes || null,
        isActive: cleaned.isActive,
      };
      if (editingId) await api.patch(`/receivers/${editingId}`, payload);
      else await api.post('/receivers', payload);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY);
      await qc.invalidateQueries({ queryKey: ['receivers'] });
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to save receiver',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/receivers/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['receivers'] });
    },
  });

  const openEdit = async (row: Receiver) => {
    setEditingId(row.id);
    setOpen(true);
    setError('');
    try {
      const res = await api.get(`/receivers/${row.id}`);
      const r = unwrap<Receiver>(res.data);
      setForm({
        name: r.name || '',
        phone: r.phone || '',
        email: r.email || '',
        address: r.address || '',
        city: r.city || '',
        state: r.state || '',
        cityId: r.cityId || '',
        stateId: r.stateId || '',
        pincode: r.pincode || '',
        notes: r.notes || '',
        isActive: r.isActive,
      });
    } catch {
      setForm({
        name: row.name || '',
        phone: row.phone || '',
        email: row.email || '',
        address: row.address || '',
        city: row.city || '',
        state: row.state || '',
        cityId: row.cityId || '',
        stateId: row.stateId || '',
        pincode: row.pincode || '',
        notes: row.notes || '',
        isActive: row.isActive,
      });
    }
  };

  const columns = useMemo((): AppColumn<Receiver>[] => {
    const cols: AppColumn<Receiver>[] = [
      { field: 'name', header: 'Name' },
      { field: 'phone', header: 'Phone' },
      { field: 'city', header: 'City' },
      { field: 'state', header: 'State' },
      { field: 'pincode', header: 'Pincode' },
      {
        header: 'Status',
        body: (row) => (
          <Tag severity={row.isActive ? 'success' : 'danger'}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Tag>
        ),
      },
    ];
    if (isAdmin) {
      cols.push({
        header: 'Branch Manager',
        body: (row) => ownerDisplayName(row.createdBy),
      });
    }
    cols.push({
      header: 'Actions',
      body: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <Button size="small" text icon="pi pi-pencil" label="Edit" onClick={() => openEdit(row)} />
          <Button
            size="small"
            text
            severity="danger"
            icon="pi pi-trash"
            label="Delete"
            onClick={() =>
              confirmDialog({
                header: 'Delete receiver',
                message: `Remove "${row.name}"? Soft delete hides it from lists.`,
                acceptClassName: 'p-button-danger',
                acceptLabel: 'Delete',
                rejectLabel: 'Cancel',
                accept: () => deleteMutation.mutate(row.id),
              })
            }
          />
        </div>
      ),
    });
    return cols;
  }, [isAdmin, deleteMutation]);

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Receivers</h1>
        <Button
          label="Add receiver"
          icon="pi pi-plus"
          onClick={() => {
            setEditingId(null);
            setForm(EMPTY);
            setError('');
            setOpen(true);
          }}
        />
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Master list of receivers for bookings. Link city/state for accurate rates.
      </p>
      <ListSearch
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search name / phone / city"
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
            columns={columns}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header={editingId ? 'Edit receiver' : 'New receiver'}
        visible={open}
        onHide={() => setOpen(false)}
        style={{ width: 'min(560px, 95vw)' }}
      >
        <div className="form-grid">
          <div className="field">
            <label>Name</label>
            <InputText
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Phone</label>
            <InputText
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Email</label>
            <InputText
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Address</label>
            <InputText
              value={form.address}
              onChange={(e) =>
                setForm((p) => ({ ...p, address: e.target.value }))
              }
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>State</label>
            <Select
              value={form.stateId || null}
              options={(statesQuery.data?.data ?? []).map((s) => ({
                label: s.name,
                value: s.id,
              }))}
              onChange={(e) => {
                const stateId = String(e.value || '');
                const st = (statesQuery.data?.data ?? []).find(
                  (s) => s.id === stateId,
                );
                setForm((p) => ({
                  ...p,
                  stateId,
                  state: st?.name || '',
                  cityId: '',
                  city: '',
                }));
              }}
              placeholder="Select state"
              filter
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>City</label>
            <Select
              value={form.cityId || null}
              options={(citiesQuery.data?.data ?? []).map((c) => ({
                label: c.name,
                value: c.id,
              }))}
              onChange={(e) => {
                const cityId = String(e.value || '');
                const city = (citiesQuery.data?.data ?? []).find(
                  (c) => c.id === cityId,
                );
                setForm((p) => ({
                  ...p,
                  cityId,
                  city: city?.name || '',
                  stateId: city?.stateId || p.stateId,
                }));
              }}
              placeholder="Select city"
              filter
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Pincode</label>
            <InputText
              value={form.pincode}
              onChange={(e) =>
                setForm((p) => ({ ...p, pincode: e.target.value }))
              }
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Notes</label>
            <InputText
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full account-status-row">
            <label>Active</label>
            <ToggleSwitch
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: Boolean(e.value) }))}
            />
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button label="Cancel" severity="secondary" text onClick={() => setOpen(false)} />
          <Button
            label={editingId ? 'Save' : 'Create'}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            disabled={!form.name.trim()}
          />
        </div>
      </Dialog>
    </div>
  );
}
