'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
  Dialog,
  InputNumber,
  InputText,
  SearchSelect,
  Tag,
  ToggleSwitch,
  type AppColumn,
} from '@/components/ui';
import { useMemo, useState } from 'react';
import { ListFilterChrome, ListSearch } from '@/components/ListControls';
import { api, unwrap } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import { trimFormData } from '@/lib/trim';

interface CustomerOwner {
  id: string;
  email: string;
  userInfo?: { fullName?: string } | null;
}

interface Customer {
  id: string;
  name: string;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  primaryEmail: string | null;
  secondaryEmail: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cityId: string | null;
  stateId: string | null;
  pincode: string | null;
  gstin: string | null;
  panNumber: string | null;
  notes: string | null;
  fuelChargesExtraPercent: string | number;
  fovPercent: string | number;
  isActive: boolean;
  createdBy?: CustomerOwner | null;
}

interface CustomerForm {
  name: string;
  primaryPhone: string;
  secondaryPhone: string;
  primaryEmail: string;
  secondaryEmail: string;
  address: string;
  city: string;
  state: string;
  cityId: string;
  stateId: string;
  pincode: string;
  gstin: string;
  panNumber: string;
  notes: string;
  fuelChargesExtraPercent: number;
  fovPercent: number;
  isActive: boolean;
}

const EMPTY_FORM: CustomerForm = {
  name: '',
  primaryPhone: '',
  secondaryPhone: '',
  primaryEmail: '',
  secondaryEmail: '',
  address: '',
  city: '',
  state: '',
  cityId: '',
  stateId: '',
  pincode: '',
  gstin: '',
  panNumber: '',
  notes: '',
  fuelChargesExtraPercent: 0,
  fovPercent: 0,
  isActive: true,
};

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name Asc', sortBy: 'name', sortOrder: 'ASC', isDefault: true },
  { label: 'Name Desc', sortBy: 'name', sortOrder: 'DESC' },
  { label: 'Primary phone Asc', sortBy: 'primaryPhone', sortOrder: 'ASC' },
  { label: 'Primary email Asc', sortBy: 'primaryEmail', sortOrder: 'ASC' },
  { label: 'City Asc', sortBy: 'city', sortOrder: 'ASC' },
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC' },
];

function toForm(c: Customer): CustomerForm {
  return {
    name: c.name || '',
    primaryPhone: c.primaryPhone || '',
    secondaryPhone: c.secondaryPhone || '',
    primaryEmail: c.primaryEmail || '',
    secondaryEmail: c.secondaryEmail || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    cityId: c.cityId || '',
    stateId: c.stateId || '',
    pincode: c.pincode || '',
    gstin: c.gstin || '',
    panNumber: c.panNumber || '',
    notes: c.notes || '',
    fuelChargesExtraPercent: Number(c.fuelChargesExtraPercent ?? 0),
    fovPercent: Number(c.fovPercent ?? 0),
    isActive: c.isActive,
  };
}

function toPayload(form: CustomerForm) {
  const cleaned = trimFormData(form);
  return {
    name: cleaned.name,
    primaryPhone: cleaned.primaryPhone || null,
    secondaryPhone: cleaned.secondaryPhone || null,
    primaryEmail: cleaned.primaryEmail || null,
    secondaryEmail: cleaned.secondaryEmail || null,
    address: cleaned.address || null,
    city: cleaned.city || null,
    state: cleaned.state || null,
    cityId: cleaned.cityId || null,
    stateId: cleaned.stateId || null,
    pincode: cleaned.pincode || null,
    gstin: cleaned.gstin || null,
    panNumber: cleaned.panNumber || null,
    notes: cleaned.notes || null,
    fuelChargesExtraPercent: Number(form.fuelChargesExtraPercent ?? 0),
    fovPercent: Number(form.fovPercent ?? 0),
    isActive: cleaned.isActive,
  };
}

export default function CustomersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const centersQuery = useQuery({
    queryKey: ['sender-locations-booking'],
    queryFn: async () => {
      const res = await api.get('/sender-locations/booking-options');
      const payload = unwrap<
        | Array<{
            id: string;
            cityId: string;
            stateId: string | null;
            label: string;
            stateName?: string | null;
            state?: { name: string } | null;
          }>
        | {
            data: Array<{
              id: string;
              cityId: string;
              stateId: string | null;
              label: string;
              stateName?: string | null;
              state?: { name: string } | null;
            }>;
          }
      >(res.data);
      if (Array.isArray(payload)) return payload;
      if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload.data;
      }
      return [];
    },
    enabled: open,
  });

  const centerOptions = useMemo(
    () =>
      (centersQuery.data ?? []).map((c) => ({
        value: c.cityId,
        label: c.label,
        subLabel: c.stateName || c.state?.name || undefined,
      })),
    [centersQuery.data],
  );

  const listQuery = useQuery({
    queryKey: ['customers', list.queryParams],
    queryFn: () => fetchPaginated<Customer>('/customers', list.queryParams),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form);
      if (editingId) {
        await api.patch(`/customers/${editingId}`, payload);
      } else {
        await api.post('/customers', payload);
      }
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setError('');
      await qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to save party';
      setError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: Customer) => {
      await api.delete(`/customers/${row.id}`);
    },
    onSuccess: async () => {
      setListError('');
      await qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to delete party';
      setListError(message);
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setOpen(true);
  };

  const openEdit = async (row: Customer) => {
    setError('');
    setEditingId(row.id);
    setOpen(true);
    try {
      const res = await api.get(`/customers/${row.id}`);
      setForm(toForm(unwrap<Customer>(res.data)));
    } catch {
      setForm(toForm(row));
    }
  };

  const askDelete = (row: Customer) => {
    confirmDialog({
      header: 'Delete party',
      message: `Remove "${row.name}"? It will be hidden from lists (soft delete).`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row),
    });
  };

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  const setField = (
    key: keyof CustomerForm,
    value: string | boolean | number,
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const tableColumns = useMemo((): AppColumn<Customer>[] => {
    const cols: AppColumn<Customer>[] = [
      { field: 'name', header: 'Name' },
      { field: 'primaryPhone', header: 'Primary phone' },
      { field: 'secondaryPhone', header: 'Secondary phone' },
      { field: 'primaryEmail', header: 'Primary email' },
      { field: 'secondaryEmail', header: 'Secondary email' },
      { field: 'city', header: 'City' },
      {
        header: 'Status',
        body: (row) => (
          <Tag severity={row.isActive ? 'success' : 'danger'}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Tag>
        ),
      },
    ];
    if (user?.role === Role.ADMIN) {
      cols.push({
        header: 'Owner',
        body: (row) =>
          row.createdBy?.userInfo?.fullName || row.createdBy?.email || '—',
      });
    }
    cols.push({
      header: 'Actions',
      body: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <Button
            size="small"
            text
            icon="pi pi-pencil"
            label="Edit"
            onClick={() => openEdit(row)}
          />
          <Button
            size="small"
            text
            severity="danger"
            icon="pi pi-trash"
            label="Delete"
            onClick={() => askDelete(row)}
          />
        </div>
      ),
    });
    return cols;
  }, [user?.role]);

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Parties</h1>
        <Button label="Add party" icon="pi pi-plus" onClick={openCreate} />
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Parties are saved under your login. Branch managers see only their own
        parties; Admin can see all.
      </p>
      <ListSearch
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search name / phone / email"
      />
      {listError ? <p className="error-text">{listError}</p> : null}
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
        header={editingId ? 'Edit party' : 'New party'}
        visible={open}
        onHide={() => setOpen(false)}
        style={{ width: 'min(640px, 95vw)' }}
      >
        <div className="form-grid">
          <div className="field full">
            <label>Party name</label>
            <InputText
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Primary phone</label>
            <InputText
              value={form.primaryPhone}
              onChange={(e) => setField('primaryPhone', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Secondary phone</label>
            <InputText
              value={form.secondaryPhone}
              onChange={(e) => setField('secondaryPhone', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Primary email</label>
            <InputText
              value={form.primaryEmail}
              onChange={(e) => setField('primaryEmail', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Secondary email</label>
            <InputText
              value={form.secondaryEmail}
              onChange={(e) => setField('secondaryEmail', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Address</label>
            <InputText
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>City</label>
            <SearchSelect
              value={form.city}
              options={centerOptions}
              placeholder="Search city from your Centers…"
              allowFreeText={false}
              emptyHint="No centers — open Centers and select cities first"
              onChange={(text) =>
                setForm((p) => ({
                  ...p,
                  city: text,
                  cityId: '',
                  stateId: '',
                  state: '',
                }))
              }
              onSelect={(opt) => {
                if (!opt) return;
                const loc = (centersQuery.data ?? []).find(
                  (c) => c.cityId === opt.value,
                );
                const stateName =
                  loc?.stateName || loc?.state?.name || opt.subLabel || '';
                setForm((p) => ({
                  ...p,
                  city: opt.label,
                  cityId: opt.value,
                  stateId: loc?.stateId || '',
                  state: stateName,
                }));
              }}
            />
            <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
              Pick from Centers only — do not type a free city name.
            </p>
          </div>
          <div className="field">
            <label>State</label>
            <InputText
              value={form.state}
              disabled
              placeholder="Filled automatically from city"
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Pincode</label>
            <InputText
              value={form.pincode}
              onChange={(e) => setField('pincode', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>GSTIN</label>
            <InputText
              value={form.gstin}
              onChange={(e) => setField('gstin', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>PAN number</label>
            <InputText
              value={form.panNumber}
              onChange={(e) => setField('panNumber', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Notes</label>
            <InputText
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Fuel charges extra %</label>
            <InputNumber
              value={form.fuelChargesExtraPercent}
              onValueChange={(e) =>
                setField('fuelChargesExtraPercent', Number(e.value ?? 0))
              }
              min={0}
              minFractionDigits={0}
              maxFractionDigits={2}
              suffix=" %"
              style={{ width: '100%' }}
              inputStyle={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>FOV (EOV) %</label>
            <InputNumber
              value={form.fovPercent}
              onValueChange={(e) => setField('fovPercent', Number(e.value ?? 0))}
              min={0}
              minFractionDigits={0}
              maxFractionDigits={2}
              suffix=" %"
              style={{ width: '100%' }}
              inputStyle={{ width: '100%' }}
            />
          </div>
          <div className="field full account-status-row">
            <div>
              <label>Active</label>
              <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                {form.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
            <ToggleSwitch
              checked={form.isActive}
              onChange={(e) => setField('isActive', Boolean(e.value))}
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
            label={editingId ? 'Save changes' : 'Create'}
            loading={saveMutation.isPending}
            disabled={!form.name.trim() || !form.cityId}
            onClick={() => saveMutation.mutate()}
          />
        </div>
      </Dialog>
    </div>
  );
}
