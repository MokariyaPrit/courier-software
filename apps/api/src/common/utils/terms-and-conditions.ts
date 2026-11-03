export type TermsVars = {
  companyName: string;
  fovPercent: string;
  fuelChargesExtraPercent: string;
  gstPercent: string;
  insurancePercent: string;
  paymentDays: string;
  volumetricDivisor: string;
  ewayBillThreshold: string;
};

/** Default commercial T&C — use {{placeholders}} for dynamic values. */
export function defaultTermsAndConditions(): string[] {
  return [
    'Payment has to be made within {{paymentDays}} days on submission of our monthly bill by Cheque/D.D. favoring {{companyName}}. Postdated cheque will not be accepted.',
    'No service provided to carry Cash, Gold, Silver, Currency, Bearer Cheque, Diamond, Share Certificates, Passport, Liquid, Breakable items and Indian Post Act [IPA] restricted items.',
    'Proof of delivery may be obtained in case of complaint, however regular payment to be made without P.O.D.',
    'Parcels and documents will be charged according to weight and size. Formula for calculation Volumetric Weight is: Length (cm) x Width (cm) x Height (cm) divided by {{volumetricDivisor}}.',
    'Each and every shipment must be attached with Invoice. And if the value of shipment exceed Rs. {{ewayBillThreshold}}, it is compulsory to provide Eway bill. If not to do so, customer will be responsible for any legal action.',
    'Goods & Services Tax @{{gstPercent}}% will be levied extra on total Bill Amount.',
    'F.O.V. (Freight on Value) will be charged {{fovPercent}}% per Thousand.',
    'Insurance rate will be charged {{insurancePercent}}%.',
    'In case of damage or misplacement of any uninsured articles the maximum liability of company will not exceed ten times of the courier charges.',
    'Bill Payments should not be linked to claims/damages. Such cases shall be settled separately.',
    'P.O.D. can be produced only for a period of Three Months from the date of booking.',
    'You cannot misuse of our consignment note which is kept at your office.',
    'Tenders and Quotation bearing opening and closing date will be accepted before 72 hrs. of its closing date and time. Same condition is applicable for Air & Railway ticket.',
    'In event of any hike in input costs like Petrol/Diesel, vehicle operational cost, Air Freight Rates, statutory levies etc. during the contract period, "{{companyName}}" shall have the right to revise the rates according.',
    'We shall have the right to exercise general lien over all shipments of the party towards any does payable to us.',
    'If any deduction, you may inform us before the deduction.',
    '{{companyName}} will not assume any responsibility or liability for any loss, direct of consequential irrespective of the amount involved due to delay in pick-up, transportation or delivery of any shipment.',
    'In unforeseen circumstances the delivery is likely to be delayed for which we will not be held responsible.',
    'If you deduct TDS amount from our account, you will have to give TDS certificate well in time and also respective PAN and address of the particular franchisee mentioned in the will shall be strictly written in the said TDS certificate.',
    'If we have not received your approval after the date of expiry of our contract, we shall consider that you have approved for next year.',
    'Termination of this contract shall be void provided both parties serves one month (30 days).',
    'Our Terms and Conditions are valid up to one year from the date of contract.',
    '{{fuelChargesExtraPercent}}% Fuel Charges Extra.',
  ];
}

export function normalizeTermsList(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const lines = value
    .map((v) => String(v ?? '').trim())
    .filter((line) => line.length > 0);
  return lines.length ? lines : null;
}

export function resolveTermsLines(
  stored: string[] | null | undefined,
  vars: TermsVars,
): string[] {
  const source =
    stored && stored.length > 0 ? stored : defaultTermsAndConditions();
  return source.map((line) =>
    line.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const v = vars[key as keyof TermsVars];
      return v != null && String(v).length ? String(v) : '';
    }),
  );
}
