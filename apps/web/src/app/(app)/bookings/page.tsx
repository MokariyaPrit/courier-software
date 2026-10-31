'use client';

import { ChargeType, ServiceType } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { useMemo, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { trimFormData } from '@/lib/trim';

interface ConsignmentRow {
  id: string;
  awb: string;
  status: string;
  receiverName: string;
  receiverPincode: string | null;
  createdAt: string;
  createdBy?: { userInfo?: { fullName?: string } | null };
}

const emptyForm = {
  senderName: '',
  senderPhone: '',
  senderAddress: '',
  receiverName: '',
  receiverPhone: '',
  receiverAddress: '',
  receiverCity: '',
  receiverPincode: '',
  weightKg: 1,
  pieces: 1,
  codAmount: 0,
  freight: 100,
  serviceType: ServiceType.STANDARD,
  remarks: '',
};

export default function BookingsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const listQuery = useQuery({
    queryKey: ['consignments', search],
    queryFn: async () => {
      const res = await api.get('/consignments', {
        params: { search: search || undefined, pageSize: 50 },
      });
      const body = res.data as { data: ConsignmentRow[]; meta?: unknown };
      return body.data ?? unwrap<ConsignmentRow[]>(res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleaned = trimFormData(form);
      await api.post('/consignments', {
        senderName: cleaned.senderName,
        senderPhone: cleaned.senderPhone || undefined,
        senderAddress: cleaned.senderAddress || undefined,
        receiverName: cleaned.receiverName,
        receiverPhone: cleaned.receiverPhone || undefined,
        receiverAddress: cleaned.receiverAddress || undefined,
        receiverCity: cleaned.receiverCity || undefined,
        receiverPincode: cleaned.receiverPincode || undefined,
        weightKg: cleaned.weightKg,
        pieces: cleaned.pieces,
        codAmount: cleaned.codAmount,
        serviceType: cleaned.serviceType,
        remarks: cleaned.remarks || undefined,
        charges: [
          {
            type: ChargeType.FREIGHT,
            amount: cleaned.freight,
            description: 'Freight',
          },
        ],
      });
    },
    onSuccess: async () => {
      setOpen(false);
      setForm(emptyForm);
      await qc.invalidateQueries({ queryKey: ['consignments'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to create booking';
      setError(message);
    },
  });

  const serviceOptions = useMemo(
    () => Object.values(ServiceType).map((v) => ({ label: v, value: v })),
    [],
  );

  return (
    <div>
      <div className="page-header">
        <h1>Bookings</h1>
        <Button label="New booking" icon="pi pi-plus" onClick={() => setOpen(true)} />
      </div>
      <div className="toolbar">
        <InputText
          placeholder="Search AWB / receiver"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="panel">
        <DataTable value={listQuery.data ?? []} loading={listQuery.isLoading} paginator rows={10}>
          <Column
            field="awb"
            header="AWB"
            body={(row: ConsignmentRow) => (
              <Link href={`/tracking?awb=${row.awb}`}>{row.awb}</Link>
            )}
          />
          <Column field="receiverName" header="Receiver" />
          <Column field="status" header="Status" />
          <Column
            header="Created by"
            body={(row: ConsignmentRow) =>
              row.createdBy?.userInfo?.fullName ?? '—'
            }
          />
          <Column
            header="Created"
            body={(row: ConsignmentRow) =>
              new Date(row.createdAt).toLocaleString()
            }
          />
        </DataTable>
      </div>

      <Dialog
        header="Create consignment"
        visible={open}
        style={{ width: 'min(720px, 95vw)' }}
        onHide={() => setOpen(false)}
      >
        <div className="form-grid">
          <div className="field">
            <label>Sender name</label>
            <InputText value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Sender phone</label>
            <InputText value={form.senderPhone} onChange={(e) => setForm({ ...form, senderPhone: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field full">
            <label>Sender address</label>
            <InputTextarea value={form.senderAddress} onChange={(e) => setForm({ ...form, senderAddress: e.target.value })} rows={2} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Receiver name</label>
            <InputText value={form.receiverName} onChange={(e) => setForm({ ...form, receiverName: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Receiver phone</label>
            <InputText value={form.receiverPhone} onChange={(e) => setForm({ ...form, receiverPhone: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field full">
            <label>Receiver address</label>
            <InputTextarea value={form.receiverAddress} onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })} rows={2} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>City</label>
            <InputText value={form.receiverCity} onChange={(e) => setForm({ ...form, receiverCity: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Pincode</label>
            <InputText value={form.receiverPincode} onChange={(e) => setForm({ ...form, receiverPincode: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Weight (kg)</label>
            <InputNumber value={form.weightKg} onValueChange={(e) => setForm({ ...form, weightKg: e.value ?? 0 })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Pieces</label>
            <InputNumber value={form.pieces} onValueChange={(e) => setForm({ ...form, pieces: e.value ?? 1 })} style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Freight</label>
            <InputNumber value={form.freight} onValueChange={(e) => setForm({ ...form, freight: e.value ?? 0 })} mode="currency" currency="INR" locale="en-IN" style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>COD amount</label>
            <InputNumber value={form.codAmount} onValueChange={(e) => setForm({ ...form, codAmount: e.value ?? 0 })} mode="currency" currency="INR" locale="en-IN" style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label>Service</label>
            <Dropdown value={form.serviceType} options={serviceOptions} onChange={(e) => setForm({ ...form, serviceType: e.value })} style={{ width: '100%' }} />
          </div>
          <div className="field full">
            <label>Remarks</label>
            <InputText value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} style={{ width: '100%' }} />
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
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
