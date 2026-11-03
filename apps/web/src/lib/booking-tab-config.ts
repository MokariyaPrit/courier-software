import { BookingType } from '@courier/shared';

/** Field keys that can participate in booking Tab navigation */
export const ACCOUNT_TAB_FIELDS = [
  { key: 'bookingDate', label: 'Booking date' },
  { key: 'customer', label: 'Party' },
  { key: 'courierCompany', label: 'Courier company' },
  { key: 'documentNumber', label: 'Document number' },
  { key: 'destination', label: 'Destination' },
  { key: 'receiverName', label: 'Receiver name' },
  { key: 'receiverPhone', label: 'Receiver phone' },
  { key: 'receiverAddress', label: 'Receiver address' },
  { key: 'serviceType', label: 'Service type' },
  { key: 'weight', label: 'Weight' },
  { key: 'price', label: 'Price' },
  { key: 'remarks', label: 'Remarks' },
] as const;

export const CASH_TAB_FIELDS = [
  { key: 'bookingDate', label: 'Booking date' },
  { key: 'partyName', label: 'Party name' },
  { key: 'courierCompany', label: 'Courier company' },
  { key: 'documentNumber', label: 'Document number' },
  { key: 'destination', label: 'Destination' },
  { key: 'partyPhone', label: 'Party phone' },
  { key: 'partyAddress', label: 'Party address' },
  { key: 'partyCity', label: 'Party city' },
  { key: 'partyGstin', label: 'Party GSTIN' },
  { key: 'receiverName', label: 'Receiver name' },
  { key: 'receiverPhone', label: 'Receiver phone' },
  { key: 'receiverAddress', label: 'Receiver address' },
  { key: 'serviceType', label: 'Service type' },
  { key: 'weight', label: 'Weight' },
  { key: 'price', label: 'Price' },
  { key: 'cgst', label: 'CGST' },
  { key: 'sgst', label: 'SGST' },
  { key: 'igst', label: 'IGST' },
  { key: 'remarks', label: 'Remarks' },
] as const;

export type AccountTabFieldKey = (typeof ACCOUNT_TAB_FIELDS)[number]['key'];
export type CashTabFieldKey = (typeof CASH_TAB_FIELDS)[number]['key'];
export type BookingTabFieldKey = AccountTabFieldKey | CashTabFieldKey;

export type BookingTabConfig = {
  account: string[];
  cash: string[];
};

export function defaultBookingTabConfig(): BookingTabConfig {
  return {
    account: ACCOUNT_TAB_FIELDS.map((f) => f.key),
    cash: CASH_TAB_FIELDS.map((f) => f.key),
  };
}

export function normalizeBookingTabConfig(
  raw?: Partial<BookingTabConfig> | null,
): BookingTabConfig {
  const defaults = defaultBookingTabConfig();
  // Never saved → tab through every field
  if (raw == null) return defaults;

  const accountAllowed = new Set(ACCOUNT_TAB_FIELDS.map((f) => f.key));
  const cashAllowed = new Set(CASH_TAB_FIELDS.map((f) => f.key));

  const account = Array.isArray(raw.account)
    ? raw.account.filter((k) => accountAllowed.has(k as AccountTabFieldKey))
    : defaults.account;
  const cash = Array.isArray(raw.cash)
    ? raw.cash.filter((k) => cashAllowed.has(k as CashTabFieldKey))
    : defaults.cash;

  return { account, cash };
}

/** Tab index for a field: selected fields get 1..n in form order; others -1 (skipped). */
export function bookingFieldTabIndex(
  fieldKey: string,
  mode: BookingType,
  config?: BookingTabConfig | null,
): number {
  const normalized = normalizeBookingTabConfig(config);
  const catalog =
    mode === BookingType.ACCOUNT ? ACCOUNT_TAB_FIELDS : CASH_TAB_FIELDS;
  const enabled = new Set(
    mode === BookingType.ACCOUNT ? normalized.account : normalized.cash,
  );
  if (!enabled.has(fieldKey)) return -1;

  let order = 0;
  for (const f of catalog) {
    if (!enabled.has(f.key)) continue;
    order += 1;
    if (f.key === fieldKey) return order;
  }
  return -1;
}

/** Create / primary action sits after the last selected field. */
export function bookingActionTabIndex(
  mode: BookingType,
  config?: BookingTabConfig | null,
): number {
  const normalized = normalizeBookingTabConfig(config);
  const enabled =
    mode === BookingType.ACCOUNT ? normalized.account : normalized.cash;
  return Math.max(enabled.length, 0) + 1;
}
