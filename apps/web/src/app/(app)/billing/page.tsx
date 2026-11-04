'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, InputNumber, InputText } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchPaginated } from '@/lib/list';
import { ownerDisplayName } from '@/lib/owner-display';

interface CustomerRow {
  id: string;
  name: string;
  city: string | null;
  isActive: boolean;
  createdBy?: {
    email?: string | null;
    userInfo?: { fullName?: string | null } | null;
  } | null;
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function firstOfMonthIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

export default function GenerateBillPage() {
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [billDate, setBillDate] = useState(todayIso);
  const [dateFrom, setDateFrom] = useState(firstOfMonthIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [sgstPercent, setSgstPercent] = useState(9);
  const [cgstPercent, setCgstPercent] = useState(9);
  const [igstPercent, setIgstPercent] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const isAdmin = user?.role === Role.ADMIN;

  useEffect(() => {
    const info = user?.userInfo;
    if (!info) return;
    setSgstPercent(Number(info.sgstPercent ?? 9));
    setCgstPercent(Number(info.cgstPercent ?? 9));
    setIgstPercent(Number(info.igstPercent ?? 0));
  }, [user?.userInfo]);

  const customersQuery = useQuery({
    queryKey: ['customers-billing-generate'],
    queryFn: () =>
      fetchPaginated<CustomerRow>('/customers', {
        page: 1,
        pageSize: 500,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
  });

  const customers = useMemo(() => {
    return (customersQuery.data?.data ?? []).filter((c) => c.isActive !== false);
  }, [customersQuery.data?.data]);

  const allSelected =
    customers.length > 0 && selected.length === customers.length;
  const someSelected = selected.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(customers.map((c) => c.id));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/billing/invoices/generate', {
        billDate,
        dateFrom,
        dateTo,
        customerIds: selected,
        sgstPercent,
        cgstPercent,
        igstPercent,
      });
      return unwrap<{
        invoices: Array<{ id: string; invoiceNumber: string }>;
        skipped: Array<{ customerName: string; reason: string }>;
        meta: { created: number; skipped: number };
      }>(res.data);
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['invoices'] });
      const created = result.meta?.created ?? result.invoices?.length ?? 0;
      const skipped = result.skipped ?? [];
      const parts = [`Generated ${created} invoice${created === 1 ? '' : 's'}.`];
      if (skipped.length) {
        parts.push(
          `Skipped ${skipped.length}: ${skipped
            .map((s) => `${s.customerName} (${s.reason})`)
            .join('; ')}`,
        );
      }
      setMessage(parts.join(' '));
      setSelected([]);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to generate bills';
      setMessage(msg);
    },
  });

  const canGenerate =
    Boolean(billDate && dateFrom && dateTo) &&
    selected.length > 0 &&
    dateFrom <= dateTo;

  return (
    <div>
      <div className="page-header">
        <h1>Generate bill</h1>
        <Button
          label="View invoices"
          icon="pi pi-list"
          severity="secondary"
          outlined
          onClick={() => router.push('/billing/invoices')}
        />
      </div>

      <div className="panel" style={{ maxWidth: 720 }}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="billDate">Bill date</label>
            <InputText
              id="billDate"
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label htmlFor="dateFrom">Start date</label>
            <InputText
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label htmlFor="dateTo">End date</label>
            <InputText
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>SGST / UTGST %</label>
            <InputNumber
              value={sgstPercent}
              onValueChange={(e) => setSgstPercent(Number(e.value ?? 0))}
              min={0}
              minFractionDigits={0}
              maxFractionDigits={2}
              suffix=" %"
              style={{ width: '100%' }}
              inputStyle={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>CGST %</label>
            <InputNumber
              value={cgstPercent}
              onValueChange={(e) => setCgstPercent(Number(e.value ?? 0))}
              min={0}
              minFractionDigits={0}
              maxFractionDigits={2}
              suffix=" %"
              style={{ width: '100%' }}
              inputStyle={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>IGST %</label>
            <InputNumber
              value={igstPercent}
              onValueChange={(e) => setIgstPercent(Number(e.value ?? 0))}
              min={0}
              minFractionDigits={0}
              maxFractionDigits={2}
              suffix=" %"
              style={{ width: '100%' }}
              inputStyle={{ width: '100%' }}
            />
          </div>
        </div>
        <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Bill amount = Sub total + SGST + CGST + IGST (defaults from Profile).
        </p>

        <div style={{ marginTop: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.65rem',
            }}
          >
            <strong>Parties</strong>
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              {selected.length} selected
            </span>
          </div>

          <div className="billing-customer-list">
            <label className="billing-customer-row billing-customer-row--all">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleAll}
                disabled={!customers.length}
              />
              <span>Select all parties</span>
            </label>

            {customersQuery.isLoading ? (
              <p className="muted" style={{ padding: '0.75rem' }}>
                Loading parties…
              </p>
            ) : customers.length === 0 ? (
              <p className="muted" style={{ padding: '0.75rem' }}>
                No parties found.
              </p>
            ) : (
              customers.map((c) => (
                <label key={c.id} className="billing-customer-row">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => toggleOne(c.id)}
                  />
                  <span>
                    {c.name}
                    {c.city ? (
                      <span className="muted"> — {c.city}</span>
                    ) : null}
                    {isAdmin ? (
                      <span className="muted" style={{ display: 'block', fontSize: '0.85rem' }}>
                        Branch Manager: {ownerDisplayName(c.createdBy)}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {message ? (
          <p style={{ marginTop: '1rem' }} className="muted">
            {message}
          </p>
        ) : null}

        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
          <Button
            label="Generate bill"
            icon="pi pi-file"
            loading={generateMutation.isPending}
            disabled={!canGenerate || generateMutation.isPending}
            onClick={() => {
              setMessage('');
              generateMutation.mutate();
            }}
          />
          {generateMutation.isSuccess &&
          (generateMutation.data?.invoices?.length ?? 0) > 0 ? (
            <Button
              label="Open invoices"
              text
              onClick={() => router.push('/billing/invoices')}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
