/** Builds the same tax-invoice HTML/CSS used by the web print page. */

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
  pan?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
  franchiseNote?: string | null;
};

type Customer = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
};

type InvoiceLine = {
  id?: string;
  date?: string | null;
  awb: string;
  type: string;
  partyName: string;
  center: string;
  weightLabel?: string;
  weightKg?: string;
  amount: string;
};

export type InvoicePrintDoc = {
  invoice: {
    invoiceNumber: string;
    billDate?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    grossAmount?: string;
    fuelSurcharge?: string;
    subTotal?: string;
    cgstPercent?: string;
    sgstPercent?: string;
    igstPercent?: string;
    cgstAmount?: string;
    sgstAmount?: string;
    igstAmount?: string;
    roundOffAmount?: string;
    totalAmount?: string;
    amountInWords?: string;
    hsnSac?: string;
    notes?: string | null;
  };
  letterhead: Letterhead;
  customer: Customer;
  lines: InvoiceLine[];
};

const ROWS_FIRST_PAGE = 22;
const ROWS_MID_PAGE = 30;
const ROWS_LAST_WITH_FOOTER = 12;

type Sheet = {
  lines: InvoiceLine[];
  showFullHeader: boolean;
  showFooter: boolean;
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

function formatDate(value?: string | null) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }
  return raw;
}

function formatDateDash(value?: string | null) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
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

function buildSheets(lines: InvoiceLine[]): Sheet[] {
  if (lines.length <= ROWS_LAST_WITH_FOOTER) {
    return [{ lines, showFullHeader: true, showFooter: true }];
  }

  const sheets: Sheet[] = [];
  let offset = 0;
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
    const leaveForLast = ROWS_LAST_WITH_FOOTER;
    const take = Math.min(ROWS_MID_PAGE, remaining - leaveForLast);
    if (take <= 0) {
      sheets.push({
        lines: lines.slice(offset),
        showFullHeader: false,
        showFooter: false,
      });
      sheets.push({ lines: [], showFullHeader: false, showFooter: true });
      break;
    }
    sheets.push({
      lines: lines.slice(offset, offset + take),
      showFullHeader: false,
      showFooter: false,
    });
    offset += take;
  }

  if (!sheets.some((s) => s.showFooter)) {
    sheets.push({ lines: [], showFullHeader: false, showFooter: true });
  }
  return sheets;
}

const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; background: #fff; color: #111;
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.invoice-print-root { margin: 0; padding: 0; background: #fff; }
.invoice-sheet {
  position: relative;
  background: #fff;
  color: #111;
  border: none;
  box-shadow: none;
  width: 210mm;
  min-height: 297mm;
  height: 297mm;
  margin: 0 auto;
  padding: 10mm 10mm 16mm;
  overflow: hidden;
  font-size: 0.82rem;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  break-inside: avoid;
}
.invoice-sheet--last { page-break-after: auto; break-after: auto; }
.inv-header { text-align: center; margin-bottom: 0.85rem; }
.inv-brand h1 {
  margin: 0; font-size: 1.35rem; letter-spacing: 0.03em; text-transform: uppercase;
}
.inv-brand p { margin: 0.15rem 0; line-height: 1.35; }
.inv-franchise { font-size: 0.78rem; color: #333; }
.inv-title {
  margin: 0.65rem 0 0; font-size: 1.15rem; text-decoration: underline; letter-spacing: 0.04em;
}
.inv-meta {
  display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem;
  margin-bottom: 0.85rem; border: 1px solid #333; padding: 0.65rem 0.75rem;
}
.inv-meta-left p, .inv-meta-right p { margin: 0.2rem 0; line-height: 1.35; }
.inv-meta-right p {
  display: grid; grid-template-columns: 7.5rem 1fr; gap: 0.35rem;
}
.inv-cont-header {
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.35rem 1rem;
  border-bottom: 1px solid #333; padding-bottom: 0.45rem; margin-bottom: 0.65rem; font-size: 0.8rem;
}
.inv-table-wrap { width: 100%; margin-bottom: 0.85rem; }
.inv-table { width: 100%; border-collapse: collapse; font-size: 0.72rem; }
.inv-table th, .inv-table td {
  border: 1px solid #333; padding: 0.28rem 0.3rem; vertical-align: top;
}
.inv-table th { background: #efefef; font-weight: 650; text-align: center; }
.inv-table td.num, .inv-table th:last-child { text-align: right; }
.inv-table thead { display: table-header-group; }
.inv-table tr { break-inside: avoid; page-break-inside: avoid; }
.inv-closing { margin-top: 0.65rem; break-inside: avoid; page-break-inside: avoid; }
.inv-footer-grid {
  display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem; margin-top: 0.5rem;
}
.inv-notes p { margin: 0.35rem 0; line-height: 1.4; }
.inv-words { margin-top: 0.85rem !important; }
.inv-totals { border: 1px solid #333; padding: 0.35rem 0.55rem; }
.inv-total-row {
  display: flex; justify-content: space-between; gap: 0.75rem;
  padding: 0.22rem 0; border-bottom: 1px dotted #bbb;
}
.inv-total-row:last-child { border-bottom: none; }
.inv-total-row--grand {
  margin-top: 0.2rem; padding-top: 0.4rem; border-top: 1px solid #333;
  border-bottom: none; font-size: 0.95rem;
}
.inv-sign { margin-top: 1.1rem; text-align: right; }
.inv-sign-space { margin-top: 1.25rem; font-size: 0.85rem; }
.inv-page-num {
  position: absolute; left: 0; right: 0; bottom: 6mm; margin: 0; padding: 0;
  text-align: center; font-size: 0.7rem; color: #333;
}
.muted { color: #444; }
`;

function linesTable(lines: InvoiceLine[]) {
  const body =
    lines.length === 0
      ? `<tr><td colspan="7" style="text-align:center">—</td></tr>`
      : lines
          .map(
            (line) => `<tr>
  <td>${esc(formatDateDash(line.date))}</td>
  <td>${esc(line.awb)}</td>
  <td>${esc(line.type)}</td>
  <td>${esc(line.partyName)}</td>
  <td>${esc(line.center)}</td>
  <td>${esc(line.weightLabel || line.weightKg || '0')}</td>
  <td class="num">${esc(money(line.amount))}</td>
</tr>`,
          )
          .join('');
  return `<div class="inv-table-wrap">
  <table class="inv-table">
    <thead>
      <tr>
        <th>Date</th><th>DOC No.</th><th>Type</th><th>Party Name</th>
        <th>Center</th><th>Weight</th><th>Amount</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
</div>`;
}

export function buildInvoicePrintHtml(doc: InvoicePrintDoc): string {
  const { invoice, letterhead, customer } = doc;
  const lines = doc.lines ?? [];
  const sheets = buildSheets(lines);
  const multiPage = sheets.length > 1;
  const totalPages = sheets.length;
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

  const sheetsHtml = sheets
    .map((sheet, pageIndex) => {
      const pageNo = pageIndex + 1;
      const isLast = pageIndex === sheets.length - 1;
      const header = sheet.showFullHeader
        ? `<header class="inv-header">
  <div class="inv-brand">
    <h1>${esc(letterhead.companyName)}</h1>
    ${letterhead.franchiseNote ? `<p class="inv-franchise">${esc(letterhead.franchiseNote)}</p>` : ''}
    ${companyAddr ? `<p>${esc(companyAddr)}</p>` : ''}
    ${letterhead.phone ? `<p>PH No.: ${esc(letterhead.phone)}</p>` : ''}
    <p>
      ${letterhead.gstin ? `GST Number: ${esc(letterhead.gstin)}` : ''}
      ${letterhead.gstin && letterhead.pan ? '  |  ' : ''}
      ${letterhead.pan ? `Pan No: ${esc(letterhead.pan)}` : ''}
    </p>
  </div>
  <h2 class="inv-title">Tax Invoice</h2>
</header>
<section class="inv-meta">
  <div class="inv-meta-left">
    <p><strong>${esc(customer.name || '—')}</strong></p>
    ${customerAddr ? `<p>${esc(customerAddr)}</p>` : ''}
    <p>GST No.: ${esc(customer.gstin || '—')}</p>
    <p>PAN No.: ${esc(customer.pan || '—')}</p>
  </div>
  <div class="inv-meta-right">
    <p><span>Bill No</span><strong>${esc(invoice.invoiceNumber)}</strong></p>
    <p><span>Date</span><strong>${esc(formatDate(invoice.billDate))}</strong></p>
    <p><span>Bill Period</span><strong>${
      invoice.periodStart && invoice.periodEnd
        ? `${esc(formatDate(invoice.periodStart))} To ${esc(formatDate(invoice.periodEnd))}`
        : '—'
    }</strong></p>
    <p><span>HSN/SAC Code</span><strong>${esc(invoice.hsnSac || '')}</strong></p>
  </div>
</section>`
        : `<header class="inv-cont-header">
  <div>
    <strong>${esc(letterhead.companyName)}</strong>
    <span class="muted"> · Tax Invoice ${esc(invoice.invoiceNumber)}</span>
  </div>
  <div class="muted">
    ${esc(customer.name || '')}${
      invoice.periodStart && invoice.periodEnd
        ? ` · ${esc(formatDate(invoice.periodStart))} To ${esc(formatDate(invoice.periodEnd))}`
        : ''
    } · Continued
  </div>
</header>`;

      const table =
        sheet.lines.length > 0 || !sheet.showFooter
          ? linesTable(sheet.lines)
          : '';

      const bankBlock =
        letterhead.bankName ||
        letterhead.bankAccountNo ||
        letterhead.bankIfsc ||
        letterhead.upiId
          ? `<div class="inv-bank">
  <p><strong>Bank details</strong></p>
  ${letterhead.bankName ? `<p>Bank Name: ${esc(letterhead.bankName)}</p>` : ''}
  ${letterhead.bankAccountNo ? `<p>Acc. No.: ${esc(letterhead.bankAccountNo)}</p>` : ''}
  ${letterhead.bankIfsc ? `<p>IFSC Code: ${esc(letterhead.bankIfsc)}</p>` : ''}
  ${letterhead.upiId ? `<p>UPI ID: ${esc(letterhead.upiId)}</p>` : ''}
</div>`
          : '';

      const footer = sheet.showFooter
        ? `<div class="inv-closing">
  <section class="inv-footer-grid">
    <div class="inv-notes">
      ${bankBlock}
      <p>Kindly issue cheque in favour of <strong>${esc(letterhead.companyName)}</strong></p>
      <p>Payment should be made within 7 days from the receipt of the bill.</p>
      <p class="muted">This is a computer generated invoice. No signature is required.</p>
      <p class="inv-words"><strong>Amount in Words:</strong> ${esc(invoice.amountInWords || '')}</p>
    </div>
    <div class="inv-totals">
      <div class="inv-total-row"><span>Gross Amount</span><strong>${esc(money(invoice.grossAmount))}</strong></div>
      <div class="inv-total-row"><span>Fuel Surcharge</span><strong>${esc(money(invoice.fuelSurcharge))}</strong></div>
      <div class="inv-total-row"><span>Sub Total</span><strong>${esc(money(invoice.subTotal))}</strong></div>
      <div class="inv-total-row"><span>SGST / UTGST (${esc(pctLabel(invoice.sgstPercent))}%)</span><strong>${esc(money(invoice.sgstAmount))}</strong></div>
      <div class="inv-total-row"><span>CGST (${esc(pctLabel(invoice.cgstPercent))}%)</span><strong>${esc(money(invoice.cgstAmount))}</strong></div>
      <div class="inv-total-row"><span>IGST (${esc(pctLabel(invoice.igstPercent))}%)</span><strong>${esc(money(invoice.igstAmount))}</strong></div>
      <div class="inv-total-row"><span>Round Off</span><strong>${esc(money(invoice.roundOffAmount))}</strong></div>
      <div class="inv-total-row inv-total-row--grand"><span>Total Bill Amount</span><strong>${esc(money(invoice.totalAmount))}</strong></div>
    </div>
  </section>
  <section class="inv-sign">
    <p>FOR, <strong>${esc(letterhead.companyName)}</strong></p>
    <p class="inv-sign-space">Authorized Signatory</p>
  </section>
</div>`
        : '';

      const pageNum = multiPage
        ? `<div class="inv-page-num">Page ${pageNo} of ${totalPages}</div>`
        : '';

      return `<article class="invoice-sheet${isLast ? ' invoice-sheet--last' : ''}">
${header}
${table}
${footer}
${pageNum}
</article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${esc(invoice.invoiceNumber)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<div class="invoice-print-root">
${sheetsHtml}
</div>
</body>
</html>`;
}
