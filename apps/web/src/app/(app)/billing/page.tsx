'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  customer?: { name: string };
}

export default function BillingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [consignmentIds, setConsignmentIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/billing/invoices', { params: { pageSize: 50 } });
      return (res.data as { data: Invoice[] }).data;
    },
  });

  const customersQuery = useQuery({
    queryKey: ['customers-billing'],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { pageSize: 100 } });
      return (res.data as { data: { id: string; name: string }[] }).data;
    },
  });

  const consignmentsQuery = useQuery({
    queryKey: ['consignments-billing'],
    queryFn: async () => {
      const res = await api.get('/consignments', { params: { pageSize: 100 } });
      return (res.data as { data: { id: string; awb: string; customerId: string | null }[] }).data;
    },
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

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
        <Button label="Create invoice" icon="pi pi-plus" onClick={() => setOpen(true)} />
      </div>
      <div className="panel">
        <DataTable value={invoicesQuery.data ?? []} loading={invoicesQuery.isLoading}>
          <Column field="invoiceNumber" header="Invoice #" />
          <Column
            header="Customer"
            body={(row: Invoice) => row.customer?.name ?? '—'}
          />
          <Column field="totalAmount" header="Amount" />
          <Column field="status" header="Status" />
          <Column
            header="Created"
            body={(row: Invoice) => new Date(row.createdAt).toLocaleString()}
          />
        </DataTable>
      </div>

      <Dialog header="New invoice" visible={open} onHide={() => setOpen(false)} style={{ width: 560 }}>
        <div className="form-grid">
          <div className="field full">
            <label>Customer</label>
            <Dropdown
              value={customerId}
              options={(customersQuery.data ?? []).map((c) => ({
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
              options={(consignmentsQuery.data ?? []).map((c) => ({
                label: c.awb,
                value: c.id,
              }))}
              onChange={(e) => setConsignmentIds(e.value)}
              placeholder="Select AWBs"
              display="chip"
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
