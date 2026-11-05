import { formatAmount, formatWeight } from './calc';
import type { AnjaniLineRow, AnjaniParsedInvoice } from './types';

function cleanLine(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function grab(text: string, regex: RegExp) {
  const match = text.match(regex);
  return match ? cleanLine(match[1]) : '';
}

function normalizeUnit(value: unknown): 'kg' | 'gm' {
  const text = String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (text.startsWith('g')) return 'gm';
  return 'kg';
}

function cleanName(value: unknown) {
  return cleanLine(value).replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
}

function splitPartyCenter(rest: string) {
  const parts = cleanLine(rest).split(' ').filter(Boolean);
  if (parts.length <= 1)
    return { party: cleanName(parts[0] || ''), center: '' };
  return {
    party: cleanName(parts.slice(0, -1).join(' ')),
    center: cleanName(parts[parts.length - 1]),
  };
}

function invoiceBody(text: string) {
  const source = String(text || '').replace(/\r/g, '');
  const start = source.search(/Customer\s*Name/i);
  return start >= 0 ? source.slice(start) : source;
}

function readCustomerCode(text: string) {
  const match = text.match(/Customer\s*Code\s*[:\-]?\s*([A-Za-z0-9-]+)/i);
  if (!match || match.index == null) return '';
  const raw = text.slice(match.index, match.index + match[0].length);
  let code = match[1];
  if (!/[:\-]/.test(raw) && /^1\d{1,4}$/.test(code)) code = code.slice(1);
  return code;
}

function readCustomerPan(text: string) {
  const match = text.match(/PAN\s*No\.?\s*[:\-]?\s*(\S+)/i);
  if (!match) return '-';
  const value = match[1].replace(/[^A-Za-z0-9-]/g, '');
  if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(value)) return value.toUpperCase();
  return '-';
}

export function parseRows(text: string): Omit<AnjaniLineRow, 'id'>[] {
  const raw = text
    .split(/\n+/)
    .map(cleanLine)
    .filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    let line = raw[i];
    const hasDate = /\d{2}[./-]\d{2}[./-]\d{4}/.test(line);
    const hasAmount = /\d[\d,]*\.\d{2}\s*$/.test(line);
    if (hasDate && !hasAmount && raw[i + 1]) {
      line = line + ' ' + raw[i + 1];
      i += 1;
    }
    lines.push(line);
  }
  const rowPattern =
    /(\d{2}[./-]\d{2}[./-]\d{4})\s+(\d{6,16})\s+([A-Za-z]{1,6})\s+(.+?)\s+(\d+(?:\.\d+)?)\s*\(?\s*(kgs?|gms?|grams?)\s*\)?\s*([\d,]+(?:\.\d{1,2})?)/i;
  const rows: Omit<AnjaniLineRow, 'id'>[] = [];
  lines.forEach((line) => {
    const match = line
      .replace(/[（]/g, '(')
      .replace(/[）]/g, ')')
      .match(rowPattern);
    if (!match) return;
    const place = splitPartyCenter(match[4]);
    rows.push({
      date: match[1].replace(/[./]/g, '-'),
      docNo: match[2],
      type: match[3].toUpperCase(),
      party: place.party.toUpperCase(),
      center: place.center.toUpperCase(),
      weight: formatWeight(match[5]),
      unit: normalizeUnit(match[6]),
      amount: formatAmount(match[7]),
    });
  });
  return rows;
}

export function parseInvoice(text: string): AnjaniParsedInvoice {
  const source = invoiceBody(text);
  const rows = parseRows(source);
  const fuelRaw = grab(
    source,
    /Fuel\s*Surcharge\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  return {
    customerName: grab(
      source,
      /Customer\s*Name\s*[:\-]?\s*(.+?)(?=\s+Bill\s*No\b|\n|$)/i,
    ),
    address1: grab(
      source,
      /Address\s*[:\-]?\s*(.+?)(?=\s+Date\s*[:\-]|\n|$)/i,
    ),
    address2: grab(
      source,
      /Address\s*[:\-]?\s*.+\n\s*([A-Z][A-Z0-9 ,.-]*?\d{3,}[A-Z0-9 ,.-]*?)(?=\s+Bill\s*No\b|\n|$)/i,
    ),
    customerGst: grab(source, /GST\s*No\.?\s*[:\-]?\s*([0-9A-Z]{15})/i),
    customerCode: readCustomerCode(source),
    customerPan: readCustomerPan(source),
    billNo: grab(
      source,
      /Bill\s*No\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9/-]*)/i,
    ),
    billDate: grab(
      source,
      /Bill\s*No\b[\s\S]{0,80}?Date\s*[:\-]?\s*(\d{2}[./-]\d{2}[./-]\d{4})/i,
    ),
    billPeriod: grab(
      source,
      /Bill\s*Period\s*[:\-]?\s*(\d{2}[./-]\d{2}[./-]\d{4}\s*(?:To|TO|to)\s*\d{2}[./-]\d{2}[./-]\d{4})/i,
    ),
    hsn: grab(
      source,
      /HSN\s*\/?\s*SAC\s*Code\s*[:\-]?\s*(\d{4,8}\s*\/\s*[A-Za-z][A-Za-z ]*)/i,
    ),
    fuel: fuelRaw ? formatAmount(fuelRaw) : '',
    bankName: grab(
      source,
      /Bank\s*Name\s*[:\-]?\s*(.+?)(?=\s+Acc(?:ount)?\b|\s+IFSC\b|\s+SGST\b|\s+Gross\b|\n|$)/i,
    ),
    accountNo: grab(
      source,
      /Acc(?:ount)?\.?\s*No\.?\s*[:\-]?\s*(\d{6,20})/i,
    ),
    ifsc: grab(source, /IFSC\s*Code\s*[:\-]?\s*([A-Z0-9]{8,15})/i),
    rows,
  };
}
