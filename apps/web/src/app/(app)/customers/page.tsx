'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { useState } from 'react';
import { ListPaginator, ListToolbar } from '@/components/ListControls';
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
  pincode: string | null;
  gstin: string | null;
  notes: string | null;
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
  pincode: string;
  gstin: string;
  notes: string;
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
  pincode: '',
  gstin: '',
  notes: '',
  isActive: true,
};

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name Asc', sortBy: 'name', sortOrder: 'ASC' },
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
    pincode: c.pincode || '',
    gstin: c.gstin || '',
    notes: c.notes || '',
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
    pincode: cleaned.pincode || null,
    gstin: cleaned.gstin || null,
    notes: cleaned.notes || null,
    isActive: cleaned.isActive,
  };
}

export default function CustomersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useListParams({ defaultSort: SORT_OPTIONS[0] });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

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
          ?.response?.data?.error?.message || 'Failed to save customer';
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
          ?.response?.data?.error?.message || 'Failed to delete customer';
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
      header: 'Delete customer',
      message: `Delete "${row.name}"?`,
      icon: 'pi pi-exclamation-triangle',
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

  const setField = (key: keyof CustomerForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Customers</h1>
        <Button label="Add customer" icon="pi pi-plus" onClick={openCreate} />
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Customers are saved under your login. Branch managers see only their own
        customers; Admin can see all.
      </p>
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search name / phone / email"
        sortKey={list.sortKey}
        onSortChange={list.setSortKey}
        sortOptions={SORT_OPTIONS}
      />
      {listError ? <p className="error-text">{listError}</p> : null}
      <div className="panel">
        <DataTable
          value={listQuery.data?.data ?? []}
          loading={listQuery.isLoading}
        >
          <Column field="name" header="Name" />
          <Column field="primaryPhone" header="Primary phone" />
          <Column field="secondaryPhone" header="Secondary phone" />
          <Column field="primaryEmail" header="Primary email" />
          <Column field="secondaryEmail" header="Secondary email" />
          <Column field="city" header="City" />
          <Column
            header="Status"
            body={(row: Customer) => (
              <Tag
                value={row.isActive ? 'Active' : 'Inactive'}
                severity={row.isActive ? 'success' : 'danger'}
              />
            )}
          />
          {user?.role === Role.ADMIN ? (
            <Column
              header="Owner"
              body={(row: Customer) =>
                row.createdBy?.userInfo?.fullName ||
                row.createdBy?.email ||
                '—'
              }
            />
          ) : null}
          <Column
            header="Actions"
            body={(row: Customer) => (
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
            )}
          />
        </DataTable>
        <ListPaginator
          meta={meta}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </div>

      <Dialog
        header={editingId ? 'Edit customer' : 'New customer'}
        visible={open}
        onHide={() => setOpen(false)}
        style={{ width: 'min(640px, 95vw)' }}
      >
        <div className="form-grid">
          <div className="field full">
            <label>Customer name</label>
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
            <InputText
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>State</label>
            <InputText
              value={form.state}
              onChange={(e) => setField('state', e.target.value)}
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
          <div className="field full">
            <label>Notes</label>
            <InputText
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full account-status-row">
            <div>
              <label>Active</label>
              <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                {form.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
            <InputSwitch
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
            onClick={() => saveMutation.mutate()}
          />
        </div>
      </Dialog>
    </div>
  );
}
