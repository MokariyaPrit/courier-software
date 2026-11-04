'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
} from '@/components/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SendDocumentEmailDialog } from '@/components/SendDocumentEmailDialog';
import { api, unwrap } from '@/lib/api';

type InvoiceLine = {
  id: string;
  date: string | null;
  awb: string;
  type: string;
  partyName: string;
  center: string;
  weightKg: string;
  weightLabel: string;
  amount: string;
};

type InvoiceDocument = {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    billDate: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    grossAmount: string;
    fuelSurcharge: string;
    subTotal: string;
    cgstPercent: string;
    sgstPercent: string;
    igstPercent: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    roundOffAmount: string;
    totalAmount: string;
    amountInWords: string;
    hsnSac: string;
    notes: string | null;
  };
  letterhead: {
    companyName: string;
    fullName: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    pan: string | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankIfsc: string | null;
    upiId: string | null;
    franchiseNote: string | null;
  };
  customer: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    gstin: string | null;
    pan: string | null;
    phone: string | null;
    email?: string | null;
  };
  lines: InvoiceLine[];
};

/** Rows that fit on first page with full header (no footer). */
const ROWS_FIRST_PAGE = 22;
/** Rows that fit on a continuation page (no footer). */
const ROWS_MID_PAGE = 30;
/** Rows that fit on last page together with totals/bank/sign. */
const ROWS_LAST_WITH_FOOTER = 12;

type InvoiceSheet = {
  lines: InvoiceLine[];
  showFullHeader: boolean;
  showFooter: boolean;
};

function buildInvoiceSheets(lines: InvoiceLine[]): InvoiceSheet[] {
  if (lines.length <= ROWS_LAST_WITH_FOOTER) {
    return [{ lines, showFullHeader: true, showFooter: true }];
  }

  const sheets: InvoiceSheet[] = [];
  let offset = 0;

  // First page: as many rows as fit without footer
  const firstCount = Math.min(ROWS_FIRST_PAGE, lines.length);
  sheets.push({
    lines: lines.slice(offset, offset + firstCount),
    showFullHeader: true,
    showFooter: false,
  });
  offset += firstCount;

  while (offset < lines.length) {
    const remaining = lines.length - offset;
    if (remaining <= ROWS_LAST_WITH_FOOTER) {
      sheets.push({
        lines: lines.slice(offset),
        showFullHeader: false,
        showFooter: true,
      });
      break;
    }

    // Still too many for footer page — fill a mid page, keep leftover for later
    const leaveForLast = ROWS_LAST_WITH_FOOTER;
    const take = Math.min(ROWS_MID_PAGE, remaining - leaveForLast);
    if (take <= 0) {
      // Remaining barely over footer capacity — put table on this page, footer alone next
      sheets.push({
        lines: lines.slice(offset),
        showFullHeader: false,
        showFooter: false,
      });
      sheets.push({
        lines: [],
        showFullHeader: false,
        showFooter: true,
      });
      break;
    }

    sheets.push({
      lines: lines.slice(offset, offset + take),
      showFullHeader: false,
      showFooter: false,
    });
    offset += take;
  }

  // Guarantee a footer sheet exists
  if (!sheets.some((s) => s.showFooter)) {
    sheets.push({ lines: [], showFullHeader: false, showFooter: true });
  }

  return sheets;
}

function formatAddr(parts: Array<string | null | undefined>) {
  return parts.filter((p) => p && String(p).trim()).join(', ');
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const raw = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }
  return raw;
}

function formatDateDash(value?: string | null) {
  if (!value) return '—';
  const raw = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}-${mm}-${yyyy}`;
  }
  return raw;
}

function money(value: string | number | null | undefined) {
  const n = Number(value || 0);
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pctLabel(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(2);
}

function printInvoice(docTitle: string) {
  const previousTitle = document.title;
  document.title = docTitle || '\u00A0';
  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.setTimeout(() => {
    window.print();
  }, 50);
}

function InvoiceLinesTable({ lines }: { lines: InvoiceLine[] }) {
  return (
    <div className="inv-table-wrap">
      <table className="inv-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>DOC No.</th>
            <th>Type</th>
            <th>Party Name</th>
            <th>Center</th>
            <th>Weight</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center' }}>
                —
              </td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line.id}>
                <td>{formatDateDash(line.date)}</td>
                <td>{line.awb}</td>
                <td>{line.type}</td>
                <td>{line.partyName}</td>
                <td>{line.center}</td>
                <td>{line.weightLabel || line.weightKg || '0'}</td>
                <td className="num">{money(line.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function InvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = String(params.id);
  const [emailOpen, setEmailOpen] = useState(false);

  const docQuery = useQuery({
    queryKey: ['invoice-document', id],
    queryFn: async () => {
      const res = await api.get(`/billing/invoices/${id}/document`);
      return unwrap<InvoiceDocument>(res.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/billing/invoices/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoices'] });
      router.push('/billing/invoices');
    },
  });

  const sheets = useMemo(
    () => buildInvoiceSheets(docQuery.data?.lines ?? []),
    [docQuery.data?.lines],
  );

  if (docQuery.isLoading) {
    return <p className="muted">Loading invoice…</p>;
  }

  if (docQuery.isError || !docQuery.data) {
    return (
      <div>
        <p className="muted">Invoice not found.</p>
        <Link href="/billing/invoices">Back to invoices</Link>
      </div>
    );
  }

  const { invoice, letterhead, customer } = docQuery.data;
  const companyAddr = formatAddr([
    letterhead.address,
    letterhead.city,
    letterhead.state,
    letterhead.pincode,
  ]);
  const customerAddr = formatAddr([
    customer.address,
    customer.city,
    customer.state,
    customer.pincode,
  ]);
  const multiPage = sheets.length > 1;
  const totalPages = sheets.length;

  const askDelete = () => {
    confirmDialog({
      header: 'Delete invoice',
      message: `Delete bill ${invoice.invoiceNumber}? Its bookings can be billed again.`,
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(),
    });
  };

  return (
    <div className="invoice-print-root">
      <ConfirmDialog />
      <SendDocumentEmailDialog
        visible={emailOpen}
        onHide={() => setEmailOpen(false)}
        title="Send invoice email"
        endpoint={`/billing/invoices/${id}/email`}
        defaultTo={customer.email || ''}
        defaultSubject={`Tax Invoice ${invoice.invoiceNumber} — ${letterhead.companyName}`}
        defaultMessage={`Please find attached tax invoice ${invoice.invoiceNumber}.`}
      />
      <div className="quotation-print-toolbar no-print">
        <div>
          <Link href="/billing/invoices" className="muted">
            ← Invoices
          </Link>
          <p className="quotation-print-hint muted">
            Tax invoice {invoice.invoiceNumber}
            {multiPage ? ` · ${totalPages} pages` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            label="Delete"
            icon="pi pi-trash"
            severity="danger"
            outlined
            loading={deleteMutation.isPending}
            onClick={askDelete}
          />
          <Button
            label="Send email"
            icon="pi pi-send"
            outlined
            onClick={() => setEmailOpen(true)}
          />
          <Button
            label="Print / PDF"
            icon="pi pi-print"
            onClick={() => printInvoice(`Invoice ${invoice.invoiceNumber}`)}
          />
        </div>
      </div>

      {sheets.map((sheet, pageIndex) => {
        const pageNo = pageIndex + 1;
        const isLast = pageIndex === sheets.length - 1;
        return (
          <article
            key={`sheet-${pageIndex}`}
            className={`invoice-sheet${isLast ? ' invoice-sheet--last' : ''}`}
          >
            {sheet.showFullHeader ? (
              <>
                <header className="inv-header">
                  <div className="inv-brand">
                    <h1>{letterhead.companyName}</h1>
                    {letterhead.franchiseNote ? (
                      <p className="inv-franchise">{letterhead.franchiseNote}</p>
                    ) : null}
                    {companyAddr ? <p>{companyAddr}</p> : null}
                    {letterhead.phone ? <p>PH No.: {letterhead.phone}</p> : null}
                    <p>
                      {letterhead.gstin ? `GST Number: ${letterhead.gstin}` : null}
                      {letterhead.gstin && letterhead.pan ? '  |  ' : null}
                      {letterhead.pan ? `Pan No: ${letterhead.pan}` : null}
                    </p>
                  </div>
                  <h2 className="inv-title">Tax Invoice</h2>
                </header>

                <section className="inv-meta">
                  <div className="inv-meta-left">
                    <p>
                      <strong>{customer.name}</strong>
                    </p>
                    {customerAddr ? <p>{customerAddr}</p> : null}
                    <p>GST No.: {customer.gstin || '—'}</p>
                    <p>PAN No.: {customer.pan || '—'}</p>
                  </div>
                  <div className="inv-meta-right">
                    <p>
                      <span>Bill No</span>
                      <strong>{invoice.invoiceNumber}</strong>
                    </p>
                    <p>
                      <span>Date</span>
                      <strong>{formatDate(invoice.billDate)}</strong>
                    </p>
                    <p>
                      <span>Bill Period</span>
                      <strong>
                        {invoice.periodStart && invoice.periodEnd
                          ? `${formatDate(invoice.periodStart)} To ${formatDate(invoice.periodEnd)}`
                          : '—'}
                      </strong>
                    </p>
                    <p>
                      <span>HSN/SAC Code</span>
                      <strong>{invoice.hsnSac}</strong>
                    </p>
                  </div>
                </section>
              </>
            ) : (
              <header className="inv-cont-header">
                <div>
                  <strong>{letterhead.companyName}</strong>
                  <span className="muted"> · Tax Invoice {invoice.invoiceNumber}</span>
                </div>
                <div className="muted">
                  {customer.name}
                  {invoice.periodStart && invoice.periodEnd
                    ? ` · ${formatDate(invoice.periodStart)} To ${formatDate(invoice.periodEnd)}`
                    : ''}
                  {' · Continued'}
                </div>
              </header>
            )}

            {(sheet.lines.length > 0 || !sheet.showFooter) && (
              <InvoiceLinesTable lines={sheet.lines} />
            )}

            {sheet.showFooter ? (
              <div className="inv-closing">
                <section className="inv-footer-grid">
                  <div className="inv-notes">
                    {(letterhead.bankName ||
                      letterhead.bankAccountNo ||
                      letterhead.bankIfsc ||
                      letterhead.upiId) && (
                      <div className="inv-bank">
                        <p>
                          <strong>Bank details</strong>
                        </p>
                        {letterhead.bankName ? (
                          <p>Bank Name: {letterhead.bankName}</p>
                        ) : null}
                        {letterhead.bankAccountNo ? (
                          <p>Acc. No.: {letterhead.bankAccountNo}</p>
                        ) : null}
                        {letterhead.bankIfsc ? (
                          <p>IFSC Code: {letterhead.bankIfsc}</p>
                        ) : null}
                        {letterhead.upiId ? <p>UPI ID: {letterhead.upiId}</p> : null}
                      </div>
                    )}
                    <p>
                      Kindly issue cheque in favour of{' '}
                      <strong>{letterhead.companyName}</strong>
                    </p>
                    <p>
                      Payment should be made within 7 days from the receipt of the
                      bill.
                    </p>
                    <p className="muted">
                      This is a computer generated invoice. No signature is
                      required.
                    </p>
                    <p className="inv-words">
                      <strong>Amount in Words:</strong> {invoice.amountInWords}
                    </p>
                  </div>
                  <div className="inv-totals">
                    <div className="inv-total-row">
                      <span>Gross Amount</span>
                      <strong>{money(invoice.grossAmount)}</strong>
                    </div>
                    <div className="inv-total-row">
                      <span>Fuel Surcharge</span>
                      <strong>{money(invoice.fuelSurcharge)}</strong>
                    </div>
                    <div className="inv-total-row">
                      <span>Sub Total</span>
                      <strong>{money(invoice.subTotal)}</strong>
                    </div>
                    <div className="inv-total-row">
                      <span>SGST / UTGST ({pctLabel(invoice.sgstPercent)}%)</span>
                      <strong>{money(invoice.sgstAmount)}</strong>
                    </div>
                    <div className="inv-total-row">
                      <span>CGST ({pctLabel(invoice.cgstPercent)}%)</span>
                      <strong>{money(invoice.cgstAmount)}</strong>
                    </div>
                    <div className="inv-total-row">
                      <span>IGST ({pctLabel(invoice.igstPercent)}%)</span>
                      <strong>{money(invoice.igstAmount)}</strong>
                    </div>
                    <div className="inv-total-row">
                      <span>Round Off</span>
                      <strong>{money(invoice.roundOffAmount)}</strong>
                    </div>
                    <div className="inv-total-row inv-total-row--grand">
                      <span>Total Bill Amount</span>
                      <strong>{money(invoice.totalAmount)}</strong>
                    </div>
                  </div>
                </section>

                <section className="inv-sign">
                  <p>
                    FOR, <strong>{letterhead.companyName}</strong>
                  </p>
                  <p className="inv-sign-space">Authorized Signatory</p>
                </section>
              </div>
            ) : null}

            {multiPage ? (
              <div className="inv-page-num">
                Page {pageNo} of {totalPages}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
