import { BadRequestException, Injectable } from '@nestjs/common';
import { htmlToPdf } from './html-to-pdf';
import {
  buildInvoicePrintHtml,
  type InvoicePrintDoc,
} from './invoice-print-html';
import {
  buildQuotationPrintHtml,
  type QuotationPrintDoc,
} from './quotation-print-html';

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

  async buildInvoicePdf(doc: InvoicePrintDoc): Promise<Buffer> {
    const html = buildInvoicePrintHtml(doc);
    try {
      return await htmlToPdf(html);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to render invoice PDF';
      throw new BadRequestException(
        `Could not build invoice PDF (needs Chrome/Edge on the server): ${message}`,
      );
    }
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
  <p>Please find attached <strong>${escapeHtml(opts.title)}</strong> (same layout as the printed document).</p>
  <table style="border-collapse:collapse;margin:12px 0">${rows}</table>
  <p>Regards,<br/>${escapeHtml(opts.companyName)}</p>
</body></html>`;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
