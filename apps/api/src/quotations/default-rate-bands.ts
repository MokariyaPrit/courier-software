import {
  QUOTATION_SERVICE_TYPE_LABELS,
  QuotationServiceType,
} from '@courier/shared';
import { ROI_RATE_COLUMN_ID } from '../rate-columns/rate-column-ids';
import type {
  RateColumnDef,
  RateMatrix,
  RateRowData,
  RateSectionDef,
} from './rate-matrix.types';

/** Default matrix always includes ROI; city/state columns come from Centers. */
export const DEFAULT_ZONE_COLUMNS: RateColumnDef[] = [
  { id: ROI_RATE_COLUMN_ID, label: 'ROI (Rest of India)', sortOrder: 0 },
];

const DOX_BANDS = [
  { weightLabel: 'Up to 100 gms', weightGrams: 100, isAdditional: false, sortOrder: 1 },
  { weightLabel: 'Up to 250 gms', weightGrams: 250, isAdditional: false, sortOrder: 2 },
  { weightLabel: 'Up to 500 gms', weightGrams: 500, isAdditional: false, sortOrder: 3 },
  { weightLabel: 'Up to 1000 gms', weightGrams: 1000, isAdditional: false, sortOrder: 4 },
];

const PARCEL_BANDS = [
  { weightLabel: 'Up to 1 kg', weightGrams: 1000, isAdditional: false, sortOrder: 1 },
  {
    weightLabel: 'Additional Weight (500 gms)',
    weightGrams: 500,
    isAdditional: true,
    sortOrder: 2,
  },
];

function emptyRates(columns: RateColumnDef[]): Record<string, string> {
  const rates: Record<string, string> = {};
  for (const col of columns) rates[col.id] = '';
  return rates;
}

export function defaultRateMatrix(
  columns: RateColumnDef[] = DEFAULT_ZONE_COLUMNS,
): RateMatrix {
  const cols = columns.map((c, i) => ({ ...c, sortOrder: c.sortOrder ?? i }));
  const sections: RateSectionDef[] = Object.values(QuotationServiceType).map(
    (id, sortOrder) => ({
      id,
      label: QUOTATION_SERVICE_TYPE_LABELS[id],
      sortOrder,
    }),
  );

  const rows: RateRowData[] = [];
  for (const serviceType of [
    QuotationServiceType.DOX,
    QuotationServiceType.DOX_BY_AIR,
    QuotationServiceType.TATKAL,
  ]) {
    for (const band of DOX_BANDS) {
      rows.push({
        sectionId: serviceType,
        weightLabel: band.weightLabel,
        weightGrams: band.weightGrams,
        isAdditional: band.isAdditional,
        sortOrder: band.sortOrder,
        rates: emptyRates(cols),
      });
    }
  }
  for (const serviceType of [
    QuotationServiceType.PARCEL,
    QuotationServiceType.PARCEL_BY_AIR,
  ]) {
    for (const band of PARCEL_BANDS) {
      rows.push({
        sectionId: serviceType,
        weightLabel: band.weightLabel,
        weightGrams: band.weightGrams,
        isAdditional: band.isAdditional,
        sortOrder: band.sortOrder,
        rates: emptyRates(cols),
      });
    }
  }

  return { columns: cols, sections, rows };
}

/**
 * Align matrix columns to the user's Rate columns selection (+ ROI).
 * Keeps rate values for columns that remain; drops stale city:/state:/roi
 * columns not in the current geography so duplicates do not linger.
 */
export function syncMatrixToGeography(
  existing: {
    columns?: RateColumnDef[];
    rows?: Array<{
      rates: Record<string, string | number>;
      [key: string]: unknown;
    }>;
  },
  geographyColumns: RateColumnDef[],
  _mode: 'cash' | 'quotation' = 'quotation',
): { columns: RateColumnDef[]; rows: Array<Record<string, unknown>> } {
  const prevCols = [...(existing.columns ?? [])];
  const geoIds = new Set(geographyColumns.map((c) => c.id));

  const nextColumns: RateColumnDef[] = geographyColumns.map((g, i) => ({
    id: g.id,
    label: g.label,
    sortOrder: i,
  }));

  // Keep only legacy non-geo extras (old Local/MAH/…), never stale city/state/roi
  let extraOrder = nextColumns.length;
  for (const col of prevCols) {
    if (geoIds.has(col.id)) continue;
    if (col.id.startsWith('city:') || col.id.startsWith('state:')) continue;
    if (col.id === ROI_RATE_COLUMN_ID) continue;
    nextColumns.push({ ...col, sortOrder: extraOrder++ });
  }

  const keepIds = new Set(nextColumns.map((c) => c.id));
  const rows = (existing.rows ?? []).map((row) => {
    const rates: Record<string, string | number> = { ...(row.rates ?? {}) };
    for (const id of Object.keys(rates)) {
      if (!keepIds.has(id)) delete rates[id];
    }
    for (const col of nextColumns) {
      if (rates[col.id] === undefined) rates[col.id] = '';
    }
    return { ...row, rates };
  });

  return { columns: nextColumns, rows };
}
