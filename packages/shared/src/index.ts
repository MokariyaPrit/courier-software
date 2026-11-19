export enum Role {
  ADMIN = 'ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

/** Computed invoice settlement for ledger UI */
export enum InvoicePaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

export enum PaymentMode {
  CASH = 'CASH',
  UPI = 'UPI',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  CHEQUE = 'CHEQUE',
  OTHER = 'OTHER',
}

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  [PaymentMode.CASH]: 'Cash',
  [PaymentMode.UPI]: 'UPI',
  [PaymentMode.NEFT]: 'NEFT',
  [PaymentMode.RTGS]: 'RTGS',
  [PaymentMode.CHEQUE]: 'Cheque',
  [PaymentMode.OTHER]: 'Other',
};

export enum LedgerTxnType {
  BILL = 'BILL',
  PAYMENT = 'PAYMENT',
}

/** Quotation contract rate service sections */
export enum QuotationServiceType {
  DOX = 'DOX',
  PARCEL = 'PARCEL',
  DOX_BY_AIR = 'DOX_BY_AIR',
  PARCEL_BY_AIR = 'PARCEL_BY_AIR',
  TATKAL = 'TATKAL',
}

export const QUOTATION_SERVICE_TYPE_LABELS: Record<
  QuotationServiceType,
  string
> = {
  [QuotationServiceType.DOX]: 'DOX',
  [QuotationServiceType.PARCEL]: 'PARCEL',
  [QuotationServiceType.DOX_BY_AIR]: 'DOX BY AIR',
  [QuotationServiceType.PARCEL_BY_AIR]: 'PARCEL BY AIR',
  [QuotationServiceType.TATKAL]: 'TATKAL (FAST TRACK)',
};

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
}

/** Booking payment / billing mode */
export enum BookingType {
  ACCOUNT = 'ACCOUNT',
  CASH = 'CASH',
}

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  [BookingType.ACCOUNT]: 'Account',
  [BookingType.CASH]: 'Cash',
};

/** Rate template purpose */
export enum RateTemplateKind {
  QUOTATION = 'QUOTATION',
  CASH = 'CASH',
}

export interface ApiSuccess<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface ApiErrorBody {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}
