import { BadRequestException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { htmlToPdf } from './html-to-pdf';
import {
  buildQuotationPrintHtml,
  type QuotationPrintDoc,
} from './quotation-print-html';

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
};

type CustomerBlock = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
};

@Injectable()
export class DocumentMailPdfService {
  /**
   * Same HTML/CSS as the web print page, rendered by Chrome/Edge headless
   * so the emailed PDF matches Print / Save PDF.
   */
  async buildQuotationPdf(doc: QuotationPrintDoc): Promise<Buffer> {
    const html = buildQuotationPrintHtml(doc);
    try {
      return await htmlToPdf(html);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to render quotation PDF';
      throw new BadRequestException(
        `Could not build quotation PDF (needs Chrome/Edge on the server): ${message}`,
      );
    }
  }

  async buildInvoicePdf(doc: {
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
      notes?: string | null;
      hsnSac?: string;
    };
    letterhead: Letterhead & {
      bankName?: string | null;
      bankAccountNo?: string | null;
      bankIfsc?: string | null;
      upiId?: string | null;
      franchiseNote?: string | null;
    };
    customer: CustomerBlock;
    lines: Array<{
      date?: string | null;
      awb: string;
      type: string;
      partyName: string;
      center: string;
      weightLabel?: string;
      amount: string;
    }>;
  }): Promise<Buffer> {
    return this.render((pdf) => {
      const lh = doc.letterhead;
      const pageWidth =
        pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;

      this.drawPrintLetterhead(pdf, lh);
      if (lh.franchiseNote?.trim()) {
        pdf
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#555')
          .text(lh.franchiseNote.trim(), { align: 'center' });
      }
      pdf.moveDown(0.5);
      pdf
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#111')
        .text('TAX INVOICE', { align: 'center' });
      pdf.moveDown(0.5);

      const inv = doc.invoice;
      pdf.font('Helvetica').fontSize(10).fillColor('#111');
      pdf.text(`Invoice No: ${inv.invoiceNumber}`);
      pdf.text(`Bill date: ${formatDateDdMmYyyy(inv.billDate)}`);
      pdf.text(
        `Period: ${formatDateDdMmYyyy(inv.periodStart)} to ${formatDateDdMmYyyy(inv.periodEnd)}`,
      );
      if (inv.hsnSac) pdf.text(`HSN / SAC: ${inv.hsnSac}`);
      pdf.moveDown(0.6);

      pdf.font('Helvetica-Bold').text('Bill To');
      pdf.font('Helvetica');
      pdf.text(doc.customer.name || '—');
      const addr = formatAddr([
        doc.customer.address,
        doc.customer.city,
        doc.customer.state,
        doc.customer.pincode,
      ]);
      if (addr) pdf.text(addr);
      if (doc.customer.gstin) pdf.text(`GSTIN: ${doc.customer.gstin}`);
      if (doc.customer.phone) pdf.text(`Phone: ${doc.customer.phone}`);
      pdf.moveDown(0.6);

      // Lines table
      const headers = [
        'Date',
        'DOC No.',
        'Type',
        'Party',
        'Center',
        'Weight',
        'Amount',
      ];
      const colWeights = [0.12, 0.14, 0.1, 0.2, 0.14, 0.12, 0.18];
      const colWidths = colWeights.map((w) => w * pageWidth);
      this.drawTableHeader(pdf, headers, colWidths);

      for (const line of doc.lines) {
        if (pdf.y > pdf.page.height - pdf.page.margins.bottom - 80) {
          pdf.addPage();
          this.drawPrintLetterhead(pdf, lh);
          pdf.moveDown(0.4);
          this.drawTableHeader(pdf, headers, colWidths);
        }
        this.drawTableRow(
          pdf,
          [
            formatDateDdMmYyyy(line.date),
            line.awb,
            line.type,
            line.partyName,
            line.center,
            line.weightLabel || '',
            money(line.amount),
          ],
          colWidths,
        );
      }

      pdf.moveDown(0.6);
      const totals: Array<[string, string]> = [
        ['Gross', money(inv.grossAmount)],
        ['Fuel surcharge', money(inv.fuelSurcharge)],
        ['Sub total', money(inv.subTotal)],
        [`CGST (${inv.cgstPercent || 0}%)`, money(inv.cgstAmount)],
        [`SGST (${inv.sgstPercent || 0}%)`, money(inv.sgstAmount)],
        [`IGST (${inv.igstPercent || 0}%)`, money(inv.igstAmount)],
        ['Round off', money(inv.roundOffAmount)],
        ['Total', money(inv.totalAmount)],
      ];
      for (const [label, value] of totals) {
        const y = pdf.y;
        pdf.font('Helvetica').fontSize(9).text(label, { continued: false });
        pdf.text(value, pdf.page.margins.left, y, {
          width: pageWidth,
          align: 'right',
        });
        pdf.y = y + 14;
      }
      if (inv.amountInWords) {
        pdf.moveDown(0.3);
        pdf
          .font('Helvetica-Oblique')
          .fontSize(9)
          .text(`Amount in words: ${inv.amountInWords}`);
      }

      const bankBits = [
        lh.bankName ? `Bank: ${lh.bankName}` : null,
        lh.bankAccountNo ? `A/C: ${lh.bankAccountNo}` : null,
        lh.bankIfsc ? `IFSC: ${lh.bankIfsc}` : null,
        lh.upiId ? `UPI: ${lh.upiId}` : null,
      ].filter(Boolean);
      if (bankBits.length) {
        pdf.moveDown(0.6);
        pdf.font('Helvetica-Bold').fontSize(10).text('Bank details');
        pdf.font('Helvetica').fontSize(9).text(bankBits.join(' · '));
      }
    });
  }

  buildEmailHtml(opts: {
    title: string;
    greetingName?: string | null;
    message?: string | null;
    companyName: string;
    details: Array<[string, string]>;
  }) {
    const greeting = opts.greetingName?.trim()
      ? `Dear ${escapeHtml(opts.greetingName.trim())},`
      : 'Dear Customer,';
    const message = opts.message?.trim()
      ? `<p>${escapeHtml(opts.message.trim()).replace(/\n/g, '<br/>')}</p>`
      : '';
    const rows = opts.details
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#555">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html><body style="font-family:Segoe UI,Arial,sans-serif;color:#222;line-height:1.45">
  <p>${greeting}</p>
  ${message}
  <p>Please find attached <strong>${escapeHtml(opts.title)}</strong> (same layout as the printed quotation).</p>
  <table style="border-collapse:collapse;margin:12px 0">${rows}</table>
  <p>Regards,<br/>${escapeHtml(opts.companyName)}</p>
</body></html>`;
  }

  private drawPrintLetterhead(pdf: PDFKit.PDFDocument, letterhead: Letterhead) {
    const pageWidth =
      pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
    pdf
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#111')
      .text((letterhead.companyName || 'Courier').toUpperCase(), {
        align: 'center',
        width: pageWidth,
      });
    const addr = formatAddr([
      letterhead.address,
      letterhead.city,
      letterhead.state,
      letterhead.pincode,
    ]);
    if (addr) {
      pdf
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#333')
        .text(addr, { align: 'center', width: pageWidth });
    }
    const contact = [
      letterhead.phone ? `Tel: ${letterhead.phone}` : null,
      letterhead.email || null,
      letterhead.gstin ? `GSTIN: ${letterhead.gstin}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    if (contact) {
      pdf
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#333')
        .text(contact, { align: 'center', width: pageWidth });
    }
    pdf.moveDown(0.35);
    const left = pdf.page.margins.left;
    const right = pdf.page.width - pdf.page.margins.right;
    const y = pdf.y;
    pdf
      .moveTo(left, y)
      .lineTo(right, y)
      .lineWidth(1.5)
      .strokeColor('#222')
      .stroke();
    pdf.y = y + 8;
  }

  private drawTableHeader(
    pdf: PDFKit.PDFDocument,
    headers: string[],
    colWidths: number[],
  ) {
    const left = pdf.page.margins.left;
    const rowH = 18;
    let x = left;
    pdf.font('Helvetica-Bold').fontSize(8).fillColor('#111');
    for (let i = 0; i < headers.length; i++) {
      pdf.rect(x, pdf.y, colWidths[i], rowH).fillAndStroke('#efefef', '#333');
      pdf.fillColor('#111').text(headers[i], x + 2, pdf.y + 5, {
        width: colWidths[i] - 4,
        align: i === 0 ? 'left' : 'center',
        lineBreak: false,
      });
      x += colWidths[i];
    }
    pdf.y += rowH;
  }

  private drawTableRow(
    pdf: PDFKit.PDFDocument,
    cells: string[],
    colWidths: number[],
  ) {
    const left = pdf.page.margins.left;
    const rowH = 16;
    let x = left;
    pdf.font('Helvetica').fontSize(8).fillColor('#111');
    for (let i = 0; i < cells.length; i++) {
      pdf.rect(x, pdf.y, colWidths[i], rowH).stroke('#333');
      pdf.text(cells[i] ?? '', x + 2, pdf.y + 4, {
        width: colWidths[i] - 4,
        align: i === 0 ? 'left' : 'center',
        lineBreak: false,
      });
      x += colWidths[i];
    }
    pdf.y += rowH;
  }

  private render(
    draw: (pdf: PDFKit.PDFDocument) => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        draw(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
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

function money(value: string | number | null | undefined) {
  const n = Number(value || 0);
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
