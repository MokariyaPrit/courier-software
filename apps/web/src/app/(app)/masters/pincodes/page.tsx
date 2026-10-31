'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Pincode {
  id: string;
  code: string;
  city: string | null;
  state: string | null;
  isServiceable: boolean;
}

export default function PincodesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    city: '',
    state: '',
  });

  const listQuery = useQuery({
    queryKey: ['pincodes', search],
    queryFn: async () => {
      const res = await api.get('/pincodes', {
        params: { search: search || undefined, pageSize: 100 },
      });
      return (res.data as { data: Pincode[] }).data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/pincodes', {
        code: form.code,
        city: form.city || undefined,
        state: form.state || undefined,
        isServiceable: true,
      });
    },
    onSuccess: async () => {
      setOpen(false);
      setForm({ code: '', city: '', state: '' });
      await qc.invalidateQueries({ queryKey: ['pincodes'] });
    },
  });

  return (
    <div>
      <div className="page-header">
        <h1>Pincodes</h1>
        <Button label="Add pincode" icon="pi pi-plus" onClick={() => setOpen(true)} />
      </div>
      <div className="toolbar">
        <InputText
          placeholder="Search code / city"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="panel">
        <DataTable value={listQuery.data ?? []} loading={listQuery.isLoading}>
          <Column field="code" header="Pincode" />
          <Column field="city" header="City" />
          <Column field="state" header="State" />
          <Column
            header="Serviceable"
            body={(row: Pincode) => (row.isServiceable ? 'Yes' : 'No')}
          />
        </DataTable>
      </div>

      <Dialog header="New pincode" visible={open} onHide={() => setOpen(false)} style={{ width: 480 }}>
        <div className="form-grid">
          <div className="field">
            <label>Code</label>
            <InputText value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>City</label>
            <InputText value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>State</label>
            <InputText value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Button label="Save" loading={createMutation.isPending} onClick={() => createMutation.mutate()} />
        </div>
      </Dialog>
    </div>
  );
}
