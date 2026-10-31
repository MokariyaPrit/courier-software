'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Branch {
  id: string;
  code: string;
  name: string;
  type: string;
  city: string | null;
  pincode: string | null;
  isActive: boolean;
}

export default function BranchesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === Role.ADMIN;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'BRANCH',
    city: '',
    pincode: '',
  });

  const listQuery = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches', { params: { pageSize: 100 } });
      return (res.data as { data: Branch[] }).data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/branches', form);
    },
    onSuccess: async () => {
      setOpen(false);
      setForm({ code: '', name: '', type: 'BRANCH', city: '', pincode: '' });
      await qc.invalidateQueries({ queryKey: ['branches'] });
    },
  });

  return (
    <div>
      <div className="page-header">
        <h1>Branches</h1>
        {isAdmin ? (
          <Button label="Add branch" icon="pi pi-plus" onClick={() => setOpen(true)} />
        ) : null}
      </div>
      <div className="panel">
        <DataTable value={listQuery.data ?? []} loading={listQuery.isLoading}>
          <Column field="code" header="Code" />
          <Column field="name" header="Name" />
          <Column field="type" header="Type" />
          <Column field="city" header="City" />
          <Column field="pincode" header="Pincode" />
          <Column
            header="Active"
            body={(row: Branch) => (row.isActive ? 'Yes' : 'No')}
          />
        </DataTable>
      </div>

      <Dialog header="New branch" visible={open} onHide={() => setOpen(false)} style={{ width: 480 }}>
        <div className="form-grid">
          <div className="field">
            <label>Code</label>
            <InputText value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Name</label>
            <InputText value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Type</label>
            <Dropdown
              value={form.type}
              options={[
                { label: 'BRANCH', value: 'BRANCH' },
                { label: 'HUB', value: 'HUB' },
              ]}
              onChange={(e) => setForm({ ...form, type: e.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>City</label>
            <InputText value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Pincode</label>
            <InputText value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Button label="Save" loading={createMutation.isPending} onClick={() => createMutation.mutate()} />
        </div>
      </Dialog>
    </div>
  );
}
