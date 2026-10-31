'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Tag } from 'primereact/tag';
import { useState } from 'react';
import { api } from '@/lib/api';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  branch?: { name: string } | null;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    password: '',
    role: Role.BRANCH_MANAGER,
    branchId: '',
  });
  const [error, setError] = useState('');

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { pageSize: 100 } });
      return (res.data as { data: UserRow[] }).data;
    },
  });

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches', { params: { pageSize: 100 } });
      return (res.data as { data: { id: string; name: string }[] }).data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/users', {
        email: form.email,
        fullName: form.fullName,
        password: form.password,
        role: form.role,
        branchId:
          form.role === Role.BRANCH_MANAGER ? form.branchId : undefined,
      });
    },
    onSuccess: async () => {
      setOpen(false);
      setError('');
      setForm({
        email: '',
        fullName: '',
        password: '',
        role: Role.BRANCH_MANAGER,
        branchId: '',
      });
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
          <Column field="fullName" header="Name" />
          <Column field="email" header="Email" />
          <Column field="role" header="Role" />
          <Column
            header="Branch"
            body={(row: UserRow) => row.branch?.name ?? '—'}
          />
          <Column
            header="Status"
            body={(row: UserRow) => (
              <Tag
                value={row.isActive ? 'Active' : 'Disabled'}
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
                label={row.isActive ? 'Disable' : 'Enable'}
                onClick={() => toggleMutation.mutate(row)}
              />
            )}
          />
        </DataTable>
      </div>

      <Dialog header="New user" visible={open} onHide={() => setOpen(false)} style={{ width: 520 }}>
        <div className="form-grid">
          <div className="field">
            <label>Full name</label>
            <InputText
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Email</label>
            <InputText
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <Password
              feedback={false}
              toggleMask
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              inputStyle={{ width: '100%' }}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Role</label>
            <Dropdown
              value={form.role}
              options={[
                { label: 'ADMIN', value: Role.ADMIN },
                { label: 'BRANCH_MANAGER', value: Role.BRANCH_MANAGER },
              ]}
              onChange={(e) => setForm({ ...form, role: e.value })}
              style={{ width: '100%' }}
            />
          </div>
          {form.role === Role.BRANCH_MANAGER ? (
            <div className="field full">
              <label>Branch</label>
              <Dropdown
                value={form.branchId}
                options={(branchesQuery.data ?? []).map((b) => ({
                  label: b.name,
                  value: b.id,
                }))}
                onChange={(e) => setForm({ ...form, branchId: e.value })}
                placeholder="Select branch"
                style={{ width: '100%' }}
              />
            </div>
          ) : null}
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
