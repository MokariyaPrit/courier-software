'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { api, unwrap } from '@/lib/api';
import type { RateColumnDef } from '@/lib/quotations';

type DocPayload = {
  quotation: {
    id: string;
    quotationCode: string | null;
    quotationDate: string;
    status: string;
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
  };
  customer: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
  };
  terms: {
    fovPercent: string;
    fuelChargesExtraPercent: string;
    gstPercent: string;
    insurancePercent: string;
  };
  columns: RateColumnDef[];
  sections: Array<{
    id: string;
    label: string;
    rows: Array<{
      weightLabel: string;
      rates: Record<string, string | number>;
    }>;
  }>;
};

function formatAddr(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(', ');
}

/** Print dates as dd-mm-yyyy */
function formatDateDdMmYyyy(value?: string | null) {
  if (!value) return '—';
  const raw = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}-${mm}-${yyyy}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function printQuotation(docTitle: string) {
  const previousTitle = document.title;
  // Empty title removes "Courier ERP" from Chrome/Edge header line.
  document.title = docTitle || '\u00A0';

  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);

  // Defer so the title update is applied before the print preview paints.
  window.setTimeout(() => {
    window.print();
  }, 50);
}

export default function QuotationPrintPage() {
  const params = useParams();
  const id = String(params.id);

  const docQuery = useQuery({
    queryKey: ['quotation-document', id],
    queryFn: async () => {
      const res = await api.get(`/quotations/${id}/document`);
      return unwrap<DocPayload>(res.data);
    },
  });

  useEffect(() => {
    if (!docQuery.data) return;
    const code = docQuery.data.quotation.quotationCode || 'DRAFT';
    const company = docQuery.data.letterhead.companyName || 'Quotation';
    const previous = document.title;
    document.title = `${company} — Quotation ${code}`;
    return () => {
      document.title = previous;
    };
  }, [docQuery.data]);

  if (docQuery.isLoading) {
    return <div className="page-center">Loading document…</div>;
  }

  const doc = docQuery.data;
  if (!doc) {
    return <p className="error-text">Could not load quotation document</p>;
  }

  const { letterhead: lh, customer: c, terms, quotation: q } = doc;
  const rateSections = (doc.sections ?? []).filter((s) => s.rows.length > 0);
  const columns = doc.columns ?? [];

  return (
    <div className="quotation-print-root">
      <div className="quotation-print-toolbar no-print">
        <p className="muted quotation-print-hint">
          In the print dialog, turn off <strong>Headers and footers</strong> so
          the date and URL do not appear on the PDF.
        </p>
        <Button
          label="Print / Save PDF"
          icon="pi pi-print"
          onClick={() => printQuotation('\u00A0')}
        />
      </div>

      {/* Page 1 — Cover letter */}
      <article className="quotation-page quotation-page--letter">
        <header className="q-letterhead">
          <h1>{lh.companyName}</h1>
          <p>{formatAddr([lh.address, lh.city, lh.state, lh.pincode])}</p>
          <p>
            {[
              lh.phone ? `Tel: ${lh.phone}` : null,
              lh.email,
              lh.gstin ? `GSTIN: ${lh.gstin}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>

        <div className="q-meta-row">
          <div>
            <strong>Quotation No:</strong> {q.quotationCode || 'DRAFT'}
          </div>
          <div>
            <strong>Date:</strong> {formatDateDdMmYyyy(q.quotationDate)}
          </div>
        </div>

        <div className="q-to-block">
          <strong>TO,</strong>
          <p>
            {c.name}
            <br />
            {formatAddr([c.address, c.city, c.state, c.pincode])}
            {c.phone ? (
              <>
                <br />
                {c.phone}
              </>
            ) : null}
          </p>
        </div>

        <p className="q-body">Dear Sir / Madam,</p>
        <p className="q-body">
          We thank you for your interest in our courier services. Please find
          enclosed our commercial quotation covering terms &amp; conditions and
          contract rates for DOX, PARCEL, DOX BY AIR, PARCEL BY AIR, and TATKAL
          (FAST TRACK) services.
        </p>
        <p className="q-body">
          We look forward to a long-term business association with you.
        </p>

        <div className="q-sign">
          <p>Yours faithfully,</p>
          <p className="q-sign-name">{lh.fullName}</p>
          <p className="muted">{lh.companyName}</p>
        </div>
      </article>

      {/* Page 2 — Terms */}
      <article className="quotation-page quotation-page--terms">
        <h2 className="q-page-title">Terms &amp; Conditions</h2>
        <ol className="q-terms">
          <li>
            F.O.V. (Freight on Value) charges @{' '}
            <strong>{terms.fovPercent}%</strong> per thousand (or as applicable).
          </li>
          <li>
            Fuel Charges Extra @ <strong>{terms.fuelChargesExtraPercent}%</strong>{' '}
            on freight (subject to revision).
          </li>
          <li>
            GST @ <strong>{terms.gstPercent}%</strong> will be charged extra as
            applicable.
          </li>
          <li>
            Optional insurance @ <strong>{terms.insurancePercent}%</strong> of
            declared value (if opted).
          </li>
          <li>
            Rates are exclusive of octroi / entry tax / other local levies unless
            stated otherwise.
          </li>
          <li>
            Weight is charged on actual or volumetric weight, whichever is higher.
          </li>
          <li>
            Liability is limited as per company policy / carrier terms unless
            separately insured.
          </li>
          <li>
            Payment terms as mutually agreed; delayed payments may attract
            interest.
          </li>
          <li>
            This quotation is valid for 30 days from the date of issue unless
            extended in writing.
          </li>
          <li>
            All disputes are subject to the jurisdiction of the courts at the
            franchisee&apos;s operating city.
          </li>
        </ol>
      </article>

      {/* Page 3+ — Contract rates (may span multiple sheets) */}
      <article className="quotation-page quotation-page--rates">
        <h2 className="q-page-title">Contract Rates</h2>
        <p className="q-rates-meta">
          Quotation {q.quotationCode || 'DRAFT'} · {c.name} ·{' '}
          {formatDateDdMmYyyy(q.quotationDate)}
        </p>
        {rateSections.length === 0 ? (
          <p className="muted">No rate rows on this quotation.</p>
        ) : (
          rateSections.map((section) => (
            <section key={section.id} className="q-rate-section">
              <h3>{section.label}</h3>
              <div className="q-rate-table-wrap">
                <table className="q-rate-table">
                  <thead>
                    <tr>
                      <th>Weight</th>
                      {columns.map((col) => (
                        <th key={col.id}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, rowIndex) => (
                      <tr key={`${section.id}-${row.weightLabel}-${rowIndex}`}>
                        <td>{row.weightLabel}</td>
                        {columns.map((col) => (
                          <td key={col.id}>
                            {Number(row.rates?.[col.id] ?? 0).toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </article>
    </div>
  );
}
