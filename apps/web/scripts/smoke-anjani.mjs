/** Smoke: Anjani parse + GST calc (no PDF/OCR). Run: node scripts/smoke-anjani.mjs */
function moneyToPaise(value) {
  const n = parseFloat(String(value ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
function formatPaise(paise) {
  const abs = Math.abs(paise);
  return (
    (paise < 0 ? '-' : '') +
    Math.floor(abs / 100) +
    '.' +
    String(abs % 100).padStart(2, '0')
  );
}
function calculate(amounts, fuelValue) {
  const gross = amounts.reduce((s, a) => s + moneyToPaise(a), 0);
  const fuel = moneyToPaise(fuelValue);
  const sub = gross + fuel;
  const sgst = Math.round((sub * 9) / 100);
  const cgst = Math.round((sub * 9) / 100);
  const igst = 0;
  const exact = sub + sgst + cgst + igst;
  const rupees = Math.floor(Math.abs(exact) / 100);
  const frac = Math.abs(exact) % 100;
  const bill =
    (exact < 0 ? -1 : 1) * (frac >= 50 ? rupees + 1 : rupees) * 100;
  return { bill };
}

const sample = `Customer Name : VIVA NX
Bill No : 2388-345
Address : BUDHWAR PETH
Date : 03/09/2026
GST No. : 27BHYPS3166D1ZR
Bill Period : 01/08/2026 To 31/08/2026
Customer Code : 75
HSN / SAC Code : 996812 / COURIER SERVICE
01-08-2026 1735770923 ND GOVIND DELHI 2 (kg) 320.00
03-08-2026 1735770926 ND NEW ARIHANT HYDERABAD 1 (kg) 40.00
Bank Name : state bank of india
Acc. No. : 62258599235
IFSC Code : SBIN0021493
Fuel Surcharge : 0.00`;

const billNo = sample.match(
  /Bill\s*No\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9/-]*)/i,
)?.[1];
const bank = sample
  .match(/Bank\s*Name\s*[:\-]?\s*(.+?)(?=\s+Acc|\n|$)/i)?.[1]
  ?.trim();
const rowRe =
  /(\d{2}[./-]\d{2}[./-]\d{4})\s+(\d{6,16})\s+([A-Za-z]{1,6})\s+(.+?)\s+(\d+(?:\.\d+)?)\s*\(?\s*(kgs?|gms?|grams?)\s*\)?\s*([\d,]+(?:\.\d{1,2})?)/gi;
const amounts = [...sample.matchAll(rowRe)].map((m) => m[7]);
const totals = calculate(amounts, '0.00');

if (billNo !== '2388-345') throw new Error('billNo parse failed: ' + billNo);
if (!/state bank/i.test(bank || '')) throw new Error('bank parse failed: ' + bank);
if (amounts.length !== 2) throw new Error('row count ' + amounts.length);
if (formatPaise(totals.bill) !== '425.00') {
  throw new Error('expected bill 425.00 got ' + formatPaise(totals.bill));
}

console.log('anjani smoke OK', {
  billNo,
  bank,
  rows: amounts.length,
  bill: formatPaise(totals.bill),
});
