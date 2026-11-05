const SGST_RATE = 9;
const CGST_RATE = 9;
const IGST_RATE = 0;

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

export function moneyToPaise(value: unknown): number {
  const n = parseFloat(String(value ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatPaise(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return (
    sign + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0')
  );
}

export function formatAmount(value: unknown): string {
  return formatPaise(moneyToPaise(value));
}

export function formatWeight(value: unknown): string {
  const text = String(value ?? '').trim();
  if (text === '') return '';
  const n = Number(text);
  if (!Number.isFinite(n)) return text;
  return String(n);
}

export function roundBillPaise(paise: number): number {
  const sign = paise < 0 ? -1 : 1;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const frac = abs % 100;
  const rounded = frac >= 50 ? rupees + 1 : rupees;
  return sign * rounded * 100;
}

function percentOf(paise: number, percent: number) {
  return Math.round((paise * percent) / 100);
}

export function calculate(amounts: unknown[], fuelValue: unknown) {
  const gross = amounts.reduce<number>(
    (sum, amount) => sum + moneyToPaise(amount),
    0,
  );
  const fuel = moneyToPaise(fuelValue);
  const sub = gross + fuel;
  const sgst = percentOf(sub, SGST_RATE);
  const cgst = percentOf(sub, CGST_RATE);
  const igst = percentOf(sub, IGST_RATE);
  const exact = sub + sgst + cgst + igst;
  const bill = roundBillPaise(exact);
  return { gross, fuel, sub, sgst, cgst, igst, exact, bill };
}

function twoDigits(n: number) {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return TENS[ten] + (one ? ' ' + ONES[one] : '');
}

function threeDigits(n: number) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (hundred && rest) return ONES[hundred] + ' Hundred and ' + twoDigits(rest);
  if (hundred) return ONES[hundred] + ' Hundred';
  return twoDigits(rest);
}

function groupWords(n: number) {
  if (n < 100) return twoDigits(n);
  return threeDigits(n);
}

export function inWords(rupees: number) {
  const n = Math.abs(Math.trunc(rupees));
  if (n === 0) return 'Zero Only';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(groupWords(crore) + ' Crore');
  if (lakh) parts.push(groupWords(lakh) + ' Lakh');
  if (thousand) parts.push(groupWords(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ') + ' Only';
}

export function billWords(paise: number) {
  const rupees = Math.trunc(paise / 100);
  const words = inWords(rupees);
  return rupees < 0 ? 'Minus ' + words : words;
}

export { SGST_RATE, CGST_RATE, IGST_RATE };
