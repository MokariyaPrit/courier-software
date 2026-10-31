import {
  QUOTATION_SERVICE_TYPE_LABELS,
  QuotationServiceType,
} from '@courier/shared';
import type {
  RateColumnDef,
  RateMatrix,
  RateRowData,
  RateSectionDef,
} from './rate-matrix.types';

export const DEFAULT_ZONE_COLUMNS: RateColumnDef[] = [
  { id: 'local', label: 'Local', sortOrder: 0 },
  { id: 'withinState', label: 'Within State', sortOrder: 1 },
  { id: 'restOfIndia', label: 'Rest Of India', sortOrder: 2 },
  { id: 'specialLocation', label: 'Special Location', sortOrder: 3 },
  { id: 'mumbai', label: 'MUMBAI', sortOrder: 4 },
  { id: 'mah', label: 'MAH', sortOrder: 5 },
  { id: 'raj', label: 'RAJ', sortOrder: 6 },
  { id: 'mp', label: 'MP', sortOrder: 7 },
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
  for (const col of columns) rates[col.id] = '0';
  return rates;
}

export function defaultRateMatrix(): RateMatrix {
  const columns = DEFAULT_ZONE_COLUMNS.map((c) => ({ ...c }));
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
        rates: emptyRates(columns),
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
        rates: emptyRates(columns),
      });
    }
  }

  return { columns, sections, rows };
}
