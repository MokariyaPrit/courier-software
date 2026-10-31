'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Tag } from 'primereact/tag';
import { useState } from 'react';
import { api } from '@/lib/api';
import { trimFormData } from '@/lib/trim';

interface UserRow {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  userInfo?: {
    fullName: string;
    phone: string | null;
    companyName: string | null;
  } | null;
}

interface CreateUserFormState {
  fullName: string;
  emailAddress: string;
  password: string;
  userRole: Role;
  phone: string;
  companyName: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  isActive: boolean;
}

const EMPTY_USER_FORM: CreateUserFormState = {
  fullName: '',
  emailAddress: '',
  password: '',
  userRole: Role.BRANCH_MANAGER,
  phone: '',
  companyName: '',
  gstin: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  isActive: true,
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateUserFormState>(EMPTY_USER_FORM);
  const [error, setError] = useState('');

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { pageSize: 100 } });
      return (res.data as { data: UserRow[] }).data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleaned = trimFormData(form);
      await api.post('/users', {
        email: cleaned.emailAddress.toLowerCase(),
        password: cleaned.password,
        role: cleaned.userRole,
        isActive: cleaned.isActive,
        fullName: cleaned.fullName,
        phone: cleaned.phone || undefined,
        companyName: cleaned.companyName || undefined,
        gstin: cleaned.gstin || undefined,
        address: cleaned.address || undefined,
        city: cleaned.city || undefined,
        state: cleaned.state || undefined,
        pincode: cleaned.pincode || undefined,
      });
    },
    onSuccess: async () => {
      setOpen(false);
      setError('');
      setForm(EMPTY_USER_FORM);
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to create user';
      setError(message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: UserRow) => {
      await api.patch(`/users/${row.id}`, { isActive: !row.isActive });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <Button label="Add user" icon="pi pi-plus" onClick={() => setOpen(true)} />
      </div>
      <div className="panel">
        <DataTable value={usersQuery.data ?? []} loading={usersQuery.isLoading}>
          <Column
            header="Full name"
            body={(row: UserRow) => row.userInfo?.fullName ?? '—'}
          />
          <Column field="email" header="Email" />
          <Column field="role" header="Role" />
          <Column
            header="Company"
            body={(row: UserRow) => row.userInfo?.companyName ?? '—'}
          />
          <Column
            header="Status"
            body={(row: UserRow) => (
              <Tag
                value={row.isActive ? 'Active' : 'Inactive'}
                severity={row.isActive ? 'success' : 'danger'}
              />
            )}
          />
          <Column
            header="Actions"
            body={(row: UserRow) => (
              <Button
                size="small"
                text
                label={row.isActive ? 'Deactivate' : 'Activate'}
                onClick={() => toggleMutation.mutate(row)}
              />
            )}
          />
        </DataTable>
      </div>

      <Dialog header="New user" visible={open} onHide={() => setOpen(false)} style={{ width: 560 }}>
        <div className="form-grid">
          <div className="field">
            <label>Full name</label>
            <InputText value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Email address</label>
            <InputText value={form.emailAddress} onChange={(e) => setForm({ ...form, emailAddress: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Password</label>
            <Password feedback={false} toggleMask value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} inputStyle={{ width: '100%' }} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>User role</label>
            <Dropdown
              value={form.userRole}
              options={[
                { label: 'Admin', value: Role.ADMIN },
                { label: 'Branch Manager', value: Role.BRANCH_MANAGER },
              ]}
              onChange={(e) => setForm({ ...form, userRole: e.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Phone</label>
            <InputText value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Company name</label>
            <InputText value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>GSTIN</label>
            <InputText value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>City</label>
            <InputText value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field full">
            <label>Address</label>
            <InputText value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>State</label>
            <InputText value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Pincode</label>
            <InputText value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field full account-status-row">
            <div>
              <label>Account status</label>
              <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                {form.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
            <InputSwitch
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: Boolean(e.value) })}
            />
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Button
            label="Create"
            loading={createMutation.isPending}
            onClick={() => {
              setError('');
              createMutation.mutate();
            }}
          />
        </div>
      </Dialog>
    </div>
  );
}
