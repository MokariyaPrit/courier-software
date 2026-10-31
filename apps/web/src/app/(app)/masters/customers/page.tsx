'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  pincode: string | null;
  gstin: string | null;
}

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
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
    queryKey: ['customers', search],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: { search: search || undefined, pageSize: 100 },
      });
      return (res.data as { data: Customer[] }).data;
    },
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

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <Button label="Add customer" icon="pi pi-plus" onClick={() => setOpen(true)} />
      </div>
      <div className="toolbar">
        <InputText
          placeholder="Search name / phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="panel">
        <DataTable value={listQuery.data ?? []} loading={listQuery.isLoading}>
          <Column field="name" header="Name" />
          <Column field="phone" header="Phone" />
          <Column field="email" header="Email" />
          <Column field="city" header="City" />
          <Column field="pincode" header="Pincode" />
          <Column field="gstin" header="GSTIN" />
        </DataTable>
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
