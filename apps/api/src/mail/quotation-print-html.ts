/** Builds the same quotation HTML/CSS used by the web print page. */

type Letterhead = {
  companyName: string;
  fullName?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
};

type Customer = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type QuotationPrintDoc = {
  quotation: {
    quotationCode?: string | null;
    quotationDate?: string | null;
  };
  letterhead: Letterhead;
  customer: Customer;
  terms?: { lines?: string[] };
  columns: Array<{ id: string; label: string }>;
  sections: Array<{
    id?: string;
    label: string;
    rows: Array<{
      weightLabel: string;
      rates?: Record<string, string | number>;
    }>;
  }>;
};

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAddr(parts: Array<string | null | undefined>) {
  return parts.filter((p) => p && String(p).trim()).join(', ');
}

function formatDateDdMmYyyy(value?: string | null) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}-${mm}-${yyyy}`;
  }
  return raw;
}

function letterheadHtml(lh: Letterhead, className: string) {
  const addr = formatAddr([lh.address, lh.city, lh.state, lh.pincode]);
  const contact = [
    lh.phone ? `Tel: ${lh.phone}` : null,
    lh.email || null,
    lh.gstin ? `GSTIN: ${lh.gstin}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `<header class="q-letterhead ${className}">
  <h1>${esc(lh.companyName || 'Courier')}</h1>
  ${addr ? `<p>${esc(addr)}</p>` : ''}
  ${contact ? `<p>${esc(contact)}</p>` : ''}
</header>`;
}

const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #111;
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.quotation-print-root { margin: 0; padding: 0; background: #fff; }
.quotation-page {
  border: none;
  max-width: none;
  margin: 0;
  padding: 34mm 12mm 12mm;
  box-shadow: none;
  background: #fff;
  color: #111;
}
.q-letterhead {
  text-align: center;
  border-bottom: 2px solid #222;
  padding-bottom: 0.45rem;
  margin-bottom: 0;
  background: #fff;
}
.q-letterhead h1 {
  margin: 0 0 0.2rem;
  font-size: 1.2rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 700;
}
.q-letterhead p {
  margin: 0.08rem 0;
  font-size: 0.78rem;
}
.q-letterhead--print-repeat {
  display: block;
  position: fixed;
  top: 8mm;
  left: 12mm;
  right: 12mm;
  z-index: 10;
}
.q-letterhead--inline { display: none; }
.q-meta-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  font-size: 0.95rem;
}
.q-to-block { margin-bottom: 1.25rem; }
.q-to-block p { margin: 0.35rem 0 0; line-height: 1.45; }
.q-body { line-height: 1.55; margin: 0.75rem 0; }
.q-sign { margin-top: 2.5rem; }
.q-sign-name { margin-top: 2rem; font-weight: 700; }
.muted { color: #444; }
.q-page-title {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  border-bottom: 1px solid #333;
  padding-bottom: 0.35rem;
}
.quotation-page--terms .q-page-title {
  margin: 0 0 0.45rem;
  font-size: 12pt;
  padding-bottom: 0.25rem;
}
.q-terms {
  line-height: 1.32;
  padding-left: 1.05rem;
  margin: 0;
  list-style: disc;
  font-size: 9.5pt;
}
.q-terms li { margin-bottom: 0.22rem; }
.q-rates-meta {
  margin: 0 0 0.85rem;
  font-size: 0.9rem;
  color: #444;
}
.q-rate-section {
  margin: 0 0 0.7rem;
  break-inside: avoid;
  page-break-inside: avoid;
}
.q-rate-section h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-align: center;
  background: #eef2f6;
  color: #1f2937;
  border: 1px solid #333;
  border-bottom: none;
  padding: 0.4rem 0.55rem;
  break-after: avoid;
  page-break-after: avoid;
}
.q-rate-table-wrap { width: 100%; overflow: visible; }
.q-rate-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.62rem;
}
.q-rate-table th,
.q-rate-table td {
  border: 1px solid #333;
  padding: 0.22rem 0.2rem;
  text-align: center;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.q-rate-table th {
  background: #efefef;
  font-weight: 650;
}
.q-rate-table td:first-child,
.q-rate-table th:first-child {
  text-align: left;
  width: 18%;
  white-space: normal;
}
.q-rate-table thead { display: table-header-group; }
.q-rate-table tr {
  break-inside: avoid;
  page-break-inside: avoid;
}
.quotation-page--letter,
.quotation-page--terms {
  break-after: page;
  page-break-after: always;
}
.quotation-page--rates {
  break-after: auto;
  page-break-after: auto;
}
`;

export function buildQuotationPrintHtml(doc: QuotationPrintDoc): string {
  const lh = doc.letterhead;
  const c = doc.customer;
  const q = doc.quotation;
  const code = q.quotationCode || 'DRAFT';
  const dateLabel = formatDateDdMmYyyy(q.quotationDate);
  const columns = doc.columns ?? [];
  const rateSections = (doc.sections ?? []).filter(
    (s) => (s.rows?.length ?? 0) > 0,
  );
  const terms = doc.terms?.lines ?? [];
  const custAddr = formatAddr([c.address, c.city, c.state, c.pincode]);

  const ratesHtml =
    rateSections.length === 0
      ? `<p class="muted">No rate rows on this quotation.</p>`
      : rateSections
          .map((section) => {
            const head = columns
              .map((col) => `<th>${esc(col.label)}</th>`)
              .join('');
            const body = section.rows
              .map((row) => {
                const cells = columns
                  .map(
                    (col) =>
                      `<td>${Number(row.rates?.[col.id] ?? 0).toFixed(2)}</td>`,
                  )
                  .join('');
                return `<tr><td>${esc(row.weightLabel)}</td>${cells}</tr>`;
              })
              .join('');
            return `<section class="q-rate-section">
  <h3>${esc(section.label)}</h3>
  <div class="q-rate-table-wrap">
    <table class="q-rate-table">
      <thead><tr><th>Weight</th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</section>`;
          })
          .join('\n');

  const termsHtml = terms
    .map((line) => `<li>${esc(line)}</li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(lh.companyName || 'Courier')} — Quotation ${esc(code)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<div class="quotation-print-root">
  ${letterheadHtml(lh, 'q-letterhead--print-repeat')}

  <article class="quotation-page quotation-page--letter">
    ${letterheadHtml(lh, 'q-letterhead--inline')}
    <div class="q-meta-row">
      <div><strong>Quotation No:</strong> ${esc(code)}</div>
      <div><strong>Date:</strong> ${esc(dateLabel)}</div>
    </div>
    <div class="q-to-block">
      <strong>TO,</strong>
      <p>
        ${esc(c.name || '—')}<br/>
        ${custAddr ? `${esc(custAddr)}<br/>` : ''}
        ${c.phone ? esc(String(c.phone)) : ''}
      </p>
    </div>
    <p class="q-body">Dear Sir / Madam,</p>
    <p class="q-body">
      We thank you for your interest in our courier services. Please find
      enclosed our commercial quotation covering terms &amp; conditions and
      contract rates for DOX, PARCEL, DOX BY AIR, PARCEL BY AIR, and TATKAL
      (FAST TRACK) services.
    </p>
    <p class="q-body">
      We look forward to a long-term business association with you.
    </p>
    <div class="q-sign">
      <p>Yours faithfully,</p>
      <p class="q-sign-name">${esc(lh.fullName || '')}</p>
      <p class="muted">${esc(lh.companyName || '')}</p>
    </div>
  </article>

  <article class="quotation-page quotation-page--terms">
    ${letterheadHtml(lh, 'q-letterhead--inline')}
    <h2 class="q-page-title">Terms &amp; Conditions</h2>
    <ul class="q-terms">
      ${termsHtml}
    </ul>
  </article>

  <article class="quotation-page quotation-page--rates">
    ${letterheadHtml(lh, 'q-letterhead--inline')}
    <h2 class="q-page-title">Contract Rates</h2>
    <p class="q-rates-meta">
      Quotation ${esc(code)} · ${esc(c.name || '—')} · ${esc(dateLabel)}
    </p>
    ${ratesHtml}
  </article>
</div>
</body>
</html>`;
}
