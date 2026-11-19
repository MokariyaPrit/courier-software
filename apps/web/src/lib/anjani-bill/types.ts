export type AnjaniLineRow = {
  id: string;
  date: string;
  docNo: string;
  type: string;
  party: string;
  center: string;
  weight: string;
  unit: string;
  amount: string;
};

export type AnjaniBillForm = {
  customerName: string;
  address1: string;
  address2: string;
  customerGst: string;
  customerCode: string;
  customerPan: string;
  billNo: string;
  billDate: string;
  billPeriod: string;
  hsn: string;
  fuel: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  gross: string;
  sub: string;
  sgst: string;
  cgst: string;
  igst: string;
  bill: string;
  words: string;
  rows: AnjaniLineRow[];
  headerImageDataUrl: string;
  sourcePdfFile: File | null;
  sourcePdfFileName: string;
};

/** Parsed PDF fields before rows get ids */
export type AnjaniParsedInvoice = Omit<
  Partial<AnjaniBillForm>,
  'rows' | 'headerImageDataUrl' | 'sourcePdfFile' | 'sourcePdfFileName'
> & {
  rows: Array<Omit<AnjaniLineRow, 'id'>>;
};

export type AnjaniStoredFile = {
  key: string;
  fileLabel: string | null;
  signedUrl: string;
  downloadUrl: string;
};

export type AnjaniBillRecord = Omit<
  AnjaniBillForm,
  'headerImageDataUrl' | 'sourcePdfFile'
> & {
  id: string;
  headerImageUrl?: string | null;
  sourcePdfUrl?: string | null;
  sourcePdfKey?: string | null;
  headerImageKey?: string | null;
  sourcePdfBytes?: number | null;
  sourcePdfFileName?: string | null;
  editedPdfUrl?: string | null;
  editedPdfKey?: string | null;
  editedPdfFileName?: string | null;
  headerImage?: AnjaniStoredFile | null;
  sourcePdf?: AnjaniStoredFile | null;
  editedPdf?: AnjaniStoredFile | null;
  layoutJson?: {
    pages: unknown[];
  } | null;
  createdAt?: string;
  updatedAt?: string;
  rows: AnjaniLineRow[];
};

export function emptyAnjaniForm(): AnjaniBillForm {
  return {
    customerName: '',
    address1: '',
    address2: '',
    customerGst: '',
    customerCode: '',
    customerPan: '',
    billNo: '',
    billDate: '',
    billPeriod: '',
    hsn: '996812 / COURIER SERVICE',
    fuel: '0.00',
    bankName: '',
    accountNo: '',
    ifsc: '',
    gross: '0.00',
    sub: '0.00',
    sgst: '0.00',
    cgst: '0.00',
    igst: '0.00',
    bill: '0.00',
    words: 'Zero Only',
    rows: [],
    headerImageDataUrl: '',
    sourcePdfFile: null,
    sourcePdfFileName: '',
  };
}

export function blankRow(id: string): AnjaniLineRow {
  return {
    id,
    date: '',
    docNo: '',
    type: 'ND',
    party: '',
    center: '',
    weight: '',
    unit: 'kg',
    amount: '',
  };
}
