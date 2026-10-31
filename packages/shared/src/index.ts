export enum Role {
  ADMIN = 'ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
}

export enum ConsignmentStatus {
  BOOKED = 'BOOKED',
  IN_TRANSIT = 'IN_TRANSIT',
  AT_HUB = 'AT_HUB',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  RTO = 'RTO',
  CANCELLED = 'CANCELLED',
  FAILED_ATTEMPT = 'FAILED_ATTEMPT',
}

export enum ChargeType {
  FREIGHT = 'FREIGHT',
  COD = 'COD',
  OTHER = 'OTHER',
}

export enum ServiceType {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
  OVERNIGHT = 'OVERNIGHT',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export const CONSIGNMENT_STATUS_FLOW: Record<
  ConsignmentStatus,
  ConsignmentStatus[]
> = {
  [ConsignmentStatus.BOOKED]: [
    ConsignmentStatus.IN_TRANSIT,
    ConsignmentStatus.CANCELLED,
  ],
  [ConsignmentStatus.IN_TRANSIT]: [
    ConsignmentStatus.AT_HUB,
    ConsignmentStatus.OUT_FOR_DELIVERY,
    ConsignmentStatus.RTO,
  ],
  [ConsignmentStatus.AT_HUB]: [
    ConsignmentStatus.IN_TRANSIT,
    ConsignmentStatus.OUT_FOR_DELIVERY,
    ConsignmentStatus.RTO,
  ],
  [ConsignmentStatus.OUT_FOR_DELIVERY]: [
    ConsignmentStatus.DELIVERED,
    ConsignmentStatus.FAILED_ATTEMPT,
    ConsignmentStatus.RTO,
  ],
  [ConsignmentStatus.FAILED_ATTEMPT]: [
    ConsignmentStatus.OUT_FOR_DELIVERY,
    ConsignmentStatus.RTO,
  ],
  [ConsignmentStatus.DELIVERED]: [],
  [ConsignmentStatus.RTO]: [],
  [ConsignmentStatus.CANCELLED]: [],
};

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
