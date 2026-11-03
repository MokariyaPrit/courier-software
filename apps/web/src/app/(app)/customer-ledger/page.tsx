'use client';

import {
  InvoicePaymentStatus,
  LedgerTxnType,
  PAYMENT_MODE_LABELS,
  PaymentMode,
} from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  Dialog,
  InputNumber,
  InputText,
  Select,
  Tag,
} from '@/components/ui';
import { api, unwrap } from '@/lib/api';

type LedgerCustomer = {
  id: string;
  name: string;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  gstin?: string | null;
  city?: string | null;
  state?: string | null;
  totalBilled: string;
  totalPaid: string;
  outstanding: string;
};

type LedgerRow = {
  id: string;
  date: string;
  type: LedgerTxnType;
  reference: string;
  debit: string;
  credit: string;
  balance: string;
  invoiceId?: string;
  paymentId?: string;
  paymentStatus?: InvoicePaymentStatus;
  mode?: string;
};

type LedgerDetail = {
  customer: {
    id: string;
    name: string;
    primaryPhone?: string | null;
    secondaryPhone?: string | null;
    primaryEmail?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gstin?: string | null;
    panNumber?: string | null;
  };
  summary: {
    totalBilled: string;
    totalPaid: string;
    outstanding: string;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    billDate: string | null;
    totalAmount: string;
    amountPaid: string;
    balanceDue: string;
    paymentStatus: InvoicePaymentStatus;
    status: string;
  }>;
  payments: Array<{
    id: string;
    paymentDate: string;
    amount: string;
    mode: PaymentMode;
    referenceNo: string | null;
    notes: string | null;
  }>;
  ledger: LedgerRow[];
};

function money(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function statusSeverity(
  s: InvoicePaymentStatus,
): 'danger' | 'warn' | 'success' | 'secondary' {
  if (s === InvoicePaymentStatus.PAID) return 'success';
  if (s === InvoicePaymentStatus.PARTIAL) return 'warn';
  if (s === InvoicePaymentStatus.UNPAID) return 'danger';
  return 'secondary';
}

function statusLabel(s: InvoicePaymentStatus) {
  if (s === InvoicePaymentStatus.PAID) return 'Paid';
  if (s === InvoicePaymentStatus.PARTIAL) return 'Partially paid';
  return 'Unpaid';
}

export default function CustomerLedgerPage() {
  const qc = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [txnType, setTxnType] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [tab, setTab] = useState<'ledger' | 'invoices' | 'payments'>('ledger');
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    paymentDate: todayIso(),
    amount: 0,
    mode: PaymentMode.CASH as PaymentMode,
    referenceNo: '',
    notes: '',
  });
  const [allocIds, setAllocIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const customersQuery = useQuery({
    queryKey: ['ledger-customers', customerSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (customerSearch.trim()) params.set('search', customerSearch.trim());
      const res = await api.get(`/ledger/customers?${params.toString()}`);
      const payload = unwrap<LedgerCustomer[]>(res.data);
      return Array.isArray(payload) ? payload : [];
    },
  });

  const detailQuery = useQuery({
    queryKey: [
      'ledger-detail',
      selectedId,
      dateFrom,
      dateTo,
      txnType,
      payStatus,
    ],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (txnType) params.set('type', txnType);
      if (payStatus) params.set('paymentStatus', payStatus);
      const q = params.toString();
      const res = await api.get(
        `/ledger/customers/${selectedId}${q ? `?${q}` : ''}`,
      );
      return unwrap<LedgerDetail>(res.data);
    },
  });

  const detail = detailQuery.data;
  const customers = customersQuery.data ?? [];

  const openInvoices = useMemo(
    () =>
      (detail?.invoices ?? []).filter(
        (i) => i.paymentStatus !== InvoicePaymentStatus.PAID,
      ),
    [detail?.invoices],
  );

  const recordPayment = useMutation({
    mutationFn: async () => {
      const allocations = openInvoices
        .filter((i) => allocIds.has(i.id))
        .map((i) => ({
          invoiceId: i.id,
          amount: Number(i.balanceDue),
        }));
      // If specific invoices selected, scale/cap to payment amount FIFO among selected
      let finalAlloc = allocations;
      if (allocations.length) {
        let left = Number(payForm.amount);
        finalAlloc = [];
        for (const a of allocations) {
          if (left <= 0) break;
          const take = Math.min(a.amount, left);
          if (take > 0) {
            finalAlloc.push({ invoiceId: a.invoiceId, amount: take });
            left = Math.round((left - take) * 100) / 100;
          }
        }
      }
      await api.post('/ledger/payments', {
        customerId: selectedId,
        paymentDate: payForm.paymentDate,
        amount: Number(payForm.amount),
        mode: payForm.mode,
        referenceNo: payForm.referenceNo || null,
        notes: payForm.notes || null,
        allocations: finalAlloc.length ? finalAlloc : undefined,
      });
    },
    onSuccess: async () => {
      setPayOpen(false);
      setError('');
      setAllocIds(new Set());
      setPayForm({
        paymentDate: todayIso(),
        amount: 0,
        mode: PaymentMode.CASH,
        referenceNo: '',
        notes: '',
      });
      await qc.invalidateQueries({ queryKey: ['ledger-detail'] });
      await qc.invalidateQueries({ queryKey: ['ledger-customers'] });
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to record payment',
      );
    },
  });

  const deletePayment = (paymentId: string, ref: string) => {
    confirmDialog({
      header: 'Delete payment',
      message: `Delete payment ${ref}? Invoice balances will be restored.`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: async () => {
        await api.delete(`/ledger/payments/${paymentId}`);
        await qc.invalidateQueries({ queryKey: ['ledger-detail'] });
        await qc.invalidateQueries({ queryKey: ['ledger-customers'] });
      },
    });
  };

  const exportCsv = () => {
    if (!detail) return;
    const lines = [
      'Date,Type,Reference,Debit,Credit,Balance',
      ...detail.ledger.map(
        (r) =>
          `${r.date},${r.type},${JSON.stringify(r.reference)},${r.debit},${r.credit},${r.balance}`,
      ),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${detail.customer.name.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printStatement = () => window.print();

  const openPayDialog = () => {
    const due = Number(detail?.summary.outstanding || 0);
    setPayForm({
      paymentDate: todayIso(),
      amount: due > 0 ? due : 0,
      mode: PaymentMode.CASH,
      referenceNo: '',
      notes: '',
    });
    setAllocIds(new Set());
    setError('');
    setPayOpen(true);
  };

  return (
    <div className="ledger-page">
      <ConfirmDialog />
      <div className="page-header no-print">
        <div>
          <h1>Customer ledger</h1>
          <p className="muted" style={{ margin: 0 }}>
            Bills debit the account; payments credit it. Running balance is
            outstanding.
          </p>
        </div>
        {selectedId && detail ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              label="Record payment"
              icon="pi pi-wallet"
              onClick={openPayDialog}
            />
            <Button
              label="Export CSV"
              icon="pi pi-download"
              outlined
              onClick={exportCsv}
            />
            <Button
              label="Print"
              icon="pi pi-print"
              outlined
              onClick={printStatement}
            />
          </div>
        ) : null}
      </div>

      <div className="ledger-layout">
        <aside className="panel ledger-customers no-print">
          <InputText
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Search customer…"
            style={{ width: '100%', marginBottom: '0.75rem' }}
          />
          {customersQuery.isLoading ? (
            <p className="muted">Loading…</p>
          ) : customers.length === 0 ? (
            <p className="muted">No customers</p>
          ) : (
            <ul className="ledger-customer-list">
              {customers.map((c) => {
                const active = c.id === selectedId;
                const due = Number(c.outstanding);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={
                        active
                          ? 'ledger-customer-item active'
                          : 'ledger-customer-item'
                      }
                      onClick={() => setSelectedId(c.id)}
                    >
                      <span className="ledger-customer-name">{c.name}</span>
                      <span
                        className={
                          due > 0
                            ? 'ledger-customer-due due'
                            : 'ledger-customer-due'
                        }
                      >
                        ₹{money(c.outstanding)}
                      </span>
                      {c.primaryPhone ? (
                        <span className="muted ledger-customer-meta">
                          {c.primaryPhone}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="ledger-main">
          {!selectedId ? (
            <div className="panel">
              <p className="muted" style={{ margin: 0 }}>
                Select a customer to view their ledger.
              </p>
            </div>
          ) : detailQuery.isLoading || !detail ? (
            <div className="panel">
              <p className="muted">Loading ledger…</p>
            </div>
          ) : (
            <>
              <div className="panel ledger-header">
                <div>
                  <h2 style={{ margin: '0 0 0.35rem' }}>
                    {detail.customer.name}
                  </h2>
                  <p className="muted" style={{ margin: 0 }}>
                    {[
                      detail.customer.primaryPhone,
                      detail.customer.gstin
                        ? `GSTIN ${detail.customer.gstin}`
                        : null,
                      [detail.customer.city, detail.customer.state]
                        .filter(Boolean)
                        .join(', ') || null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <div className="ledger-outstanding">
                  <span className="muted">Outstanding</span>
                  <strong>₹{money(detail.summary.outstanding)}</strong>
                </div>
              </div>

              <div className="ledger-summary">
                <div className="panel ledger-summary-card">
                  <span className="muted">Total billed</span>
                  <strong>₹{money(detail.summary.totalBilled)}</strong>
                </div>
                <div className="panel ledger-summary-card">
                  <span className="muted">Total received</span>
                  <strong className="ledger-credit-text">
                    ₹{money(detail.summary.totalPaid)}
                  </strong>
                </div>
                <div className="panel ledger-summary-card">
                  <span className="muted">Outstanding</span>
                  <strong className="ledger-debit-text">
                    ₹{money(detail.summary.outstanding)}
                  </strong>
                </div>
              </div>

              <div className="panel no-print" style={{ marginBottom: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <label className="ledger-filter">
                    <span className="muted">From</span>
                    <InputText
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label className="ledger-filter">
                    <span className="muted">To</span>
                    <InputText
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                  <Select
                    value={txnType}
                    options={[
                      { label: 'All types', value: '' },
                      { label: 'Bills', value: LedgerTxnType.BILL },
                      { label: 'Payments', value: LedgerTxnType.PAYMENT },
                    ]}
                    onChange={(e) => setTxnType(String(e.value || ''))}
                    placeholder="Type"
                    style={{ minWidth: '9rem' }}
                  />
                  <Select
                    value={payStatus}
                    options={[
                      { label: 'All bill statuses', value: '' },
                      {
                        label: 'Unpaid bills',
                        value: InvoicePaymentStatus.UNPAID,
                      },
                      {
                        label: 'Partially paid',
                        value: InvoicePaymentStatus.PARTIAL,
                      },
                      { label: 'Paid bills', value: InvoicePaymentStatus.PAID },
                    ]}
                    onChange={(e) => setPayStatus(String(e.value || ''))}
                    placeholder="Payment status"
                    style={{ minWidth: '11rem' }}
                  />
                  <Button
                    size="small"
                    text
                    label="Clear filters"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                      setTxnType('');
                      setPayStatus('');
                    }}
                  />
                </div>
              </div>

              <div className="ledger-tabs no-print">
                {(
                  [
                    ['ledger', 'Ledger'],
                    ['invoices', 'Invoices'],
                    ['payments', 'Payments'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={tab === key ? 'active' : ''}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="panel ledger-print-block">
                <div className="ledger-print-only">
                  <h2>{detail.customer.name} — Account statement</h2>
                  <p className="muted">
                    Printed {new Date().toLocaleString()}
                  </p>
                </div>

                {tab === 'ledger' ? (
                  <div>
                    <div className="table-wrap">
                      <table className="ledger-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Reference</th>
                            <th className="num">Debit</th>
                            <th className="num">Credit</th>
                            <th className="num">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.ledger.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="muted">
                                No transactions
                              </td>
                            </tr>
                          ) : (
                            detail.ledger.map((r) => (
                              <tr key={r.id}>
                                <td>{r.date}</td>
                                <td>
                                  <span
                                    className={
                                      r.type === LedgerTxnType.BILL
                                        ? 'ledger-type bill'
                                        : 'ledger-type payment'
                                    }
                                  >
                                    {r.type === LedgerTxnType.BILL
                                      ? 'Bill'
                                      : 'Payment'}
                                  </span>
                                </td>
                                <td>
                                  {r.reference}
                                  {r.paymentStatus ? (
                                    <>
                                      {' '}
                                      <Tag
                                        severity={statusSeverity(
                                          r.paymentStatus,
                                        )}
                                      >
                                        {statusLabel(r.paymentStatus)}
                                      </Tag>
                                    </>
                                  ) : null}
                                  {r.mode ? (
                                    <span className="muted">
                                      {' '}
                                      ·{' '}
                                      {PAYMENT_MODE_LABELS[
                                        r.mode as PaymentMode
                                      ] || r.mode}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="num ledger-debit-text">
                                  {Number(r.debit) > 0
                                    ? `₹${r.debit}`
                                    : '—'}
                                </td>
                                <td className="num ledger-credit-text">
                                  {Number(r.credit) > 0
                                    ? `₹${r.credit}`
                                    : '—'}
                                </td>
                                <td className="num">₹{r.balance}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {/* Always keep a print-ready ledger copy */}
                {tab !== 'ledger' ? (
                  <div className="ledger-print-only">
                    <div className="table-wrap">
                      <table className="ledger-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Reference</th>
                            <th className="num">Debit</th>
                            <th className="num">Credit</th>
                            <th className="num">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.ledger.map((r) => (
                            <tr key={`print-${r.id}`}>
                              <td>{r.date}</td>
                              <td>
                                {r.type === LedgerTxnType.BILL
                                  ? 'Bill'
                                  : 'Payment'}
                              </td>
                              <td>{r.reference}</td>
                              <td className="num">
                                {Number(r.debit) > 0 ? r.debit : '—'}
                              </td>
                              <td className="num">
                                {Number(r.credit) > 0 ? r.credit : '—'}
                              </td>
                              <td className="num">{r.balance}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {tab === 'invoices' ? (
                  <div className="table-wrap no-print">
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Date</th>
                          <th className="num">Total</th>
                          <th className="num">Paid</th>
                          <th className="num">Due</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td>{inv.invoiceNumber}</td>
                            <td>{inv.billDate || '—'}</td>
                            <td className="num">₹{inv.totalAmount}</td>
                            <td className="num">₹{inv.amountPaid}</td>
                            <td className="num">₹{inv.balanceDue}</td>
                            <td>
                              <Tag
                                severity={statusSeverity(inv.paymentStatus)}
                              >
                                {statusLabel(inv.paymentStatus)}
                              </Tag>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {tab === 'payments' ? (
                  <div className="table-wrap no-print">
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Mode</th>
                          <th>Reference</th>
                          <th className="num">Amount</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {detail.payments.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="muted">
                              No payments yet
                            </td>
                          </tr>
                        ) : (
                          detail.payments.map((p) => (
                            <tr key={p.id}>
                              <td>{p.paymentDate}</td>
                              <td>
                                {PAYMENT_MODE_LABELS[p.mode] || p.mode}
                              </td>
                              <td>{p.referenceNo || '—'}</td>
                              <td className="num ledger-credit-text">
                                ₹{p.amount}
                              </td>
                              <td>
                                <Button
                                  size="small"
                                  text
                                  severity="danger"
                                  icon="pi pi-trash"
                                  onClick={() =>
                                    deletePayment(
                                      p.id,
                                      p.referenceNo || p.paymentDate,
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog
        header="Record payment"
        visible={payOpen}
        onHide={() => setPayOpen(false)}
        style={{ width: 'min(520px, 96vw)' }}
      >
        <div className="form-grid">
          <div className="field">
            <label>Payment date</label>
            <InputText
              type="date"
              value={payForm.paymentDate}
              onChange={(e) =>
                setPayForm((p) => ({ ...p, paymentDate: e.target.value }))
              }
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Amount</label>
            <InputNumber
              value={payForm.amount}
              onValueChange={(e) =>
                setPayForm((p) => ({
                  ...p,
                  amount: Math.max(Number(e.value ?? 0), 0),
                }))
              }
              min={0}
              minFractionDigits={0}
              maxFractionDigits={2}
              style={{ width: '100%' }}
              inputStyle={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Mode</label>
            <Select
              value={payForm.mode}
              options={Object.values(PaymentMode).map((m) => ({
                label: PAYMENT_MODE_LABELS[m],
                value: m,
              }))}
              onChange={(e) =>
                setPayForm((p) => ({
                  ...p,
                  mode: (e.value as PaymentMode) || PaymentMode.CASH,
                }))
              }
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Reference no.</label>
            <InputText
              value={payForm.referenceNo}
              onChange={(e) =>
                setPayForm((p) => ({ ...p, referenceNo: e.target.value }))
              }
              placeholder="UPI / cheque / txn id"
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Notes</label>
            <InputText
              value={payForm.notes}
              onChange={(e) =>
                setPayForm((p) => ({ ...p, notes: e.target.value }))
              }
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Apply to invoices (optional)</label>
            <p className="muted" style={{ marginTop: 0 }}>
              Leave unchecked to auto-allocate oldest unpaid bills first.
            </p>
            {openInvoices.length === 0 ? (
              <p className="muted">No open invoices</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                {openInvoices.map((inv) => (
                  <label
                    key={inv.id}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allocIds.has(inv.id)}
                      onChange={(e) => {
                        setAllocIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(inv.id);
                          else next.delete(inv.id);
                          return next;
                        });
                      }}
                    />
                    <span>
                      {inv.invoiceNumber} · due ₹{inv.balanceDue}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            label="Cancel"
            outlined
            severity="secondary"
            onClick={() => setPayOpen(false)}
          />
          <Button
            label="Save payment"
            icon="pi pi-check"
            loading={recordPayment.isPending}
            disabled={Number(payForm.amount) <= 0}
            onClick={() => recordPayment.mutate()}
          />
        </div>
      </Dialog>
    </div>
  );
}
