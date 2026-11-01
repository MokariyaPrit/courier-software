import {
  QUOTATION_SERVICE_TYPE_LABELS,
  QuotationServiceType,
} from '@courier/shared';

export type RateColumnDef = {
  id: string;
  label: string;
  sortOrder: number;
};

export type RateSectionDef = {
  id: string;
  label: string;
  sortOrder: number;
};

export const RATE_SERVICE_OPTIONS = Object.values(QuotationServiceType).map(
  (id) => ({
    value: id,
    label: QUOTATION_SERVICE_TYPE_LABELS[id],
  }),
);

export function isParcelService(sectionId: string) {
  return (
    sectionId === QuotationServiceType.PARCEL ||
    sectionId === QuotationServiceType.PARCEL_BY_AIR
  );
}

export function isDoxLikeService(sectionId: string) {
  return (
    sectionId === QuotationServiceType.DOX ||
    sectionId === QuotationServiceType.DOX_BY_AIR ||
    sectionId === QuotationServiceType.TATKAL
  );
}

/** Preset weights in grams (max 1000 g / 1 kg) */
export function weightOptionsForSection(sectionId: string): Array<{
  value: number;
  label: string;
}> {
  if (isParcelService(sectionId)) {
    return [{ value: 1000, label: '1 kg' }];
  }
  // DOX / DOX_BY_AIR / TATKAL — grams
  return [
    { value: 100, label: '100 g' },
    { value: 200, label: '200 g' },
    { value: 500, label: '500 g' },
    { value: 750, label: '750 g' },
    { value: 1000, label: '1000 g' },
  ];
}

export function weightLabelForGrams(sectionId: string, weightGrams: number) {
  const opt = weightOptionsForSection(sectionId).find(
    (o) => o.value === weightGrams,
  );
  if (opt) return opt.label;
  if (isParcelService(sectionId)) {
    const kg = weightGrams / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg} kg`;
  }
  return `${weightGrams} g`;
}

export function serviceTypeLabel(sectionId: string) {
  return (
    QUOTATION_SERVICE_TYPE_LABELS[sectionId as QuotationServiceType] ||
    sectionId
  );
}

export type RateRowForm = {
  id?: string;
  sectionId: string;
  weightLabel: string;
  weightGrams: number | null;
  isAdditional: boolean;
  sortOrder: number;
  /** Empty string = not configured (fall through in resolveRate); 0 is valid */
  rates: Record<string, number | string>;
};

export const ROI_RATE_COLUMN_ID = 'roi';

export function cityRateColumnId(cityId: string) {
  return `city:${cityId}`;
}

export function stateRateColumnId(stateId: string) {
  return `state:${stateId}`;
}

export function isRateConfigured(
  value: string | number | null | undefined,
): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return !Number.isNaN(Number(value));
}

export type RateMatrixForm = {
  columns: RateColumnDef[];
  sections: RateSectionDef[];
  rows: RateRowForm[];
};

export function newId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyRatesForColumns(
  columns: RateColumnDef[],
): Record<string, number | string> {
  const rates: Record<string, number | string> = {};
  for (const col of columns) rates[col.id] = '';
  return rates;
}

export function toRateRowForm(row: {
  id?: string;
  sectionId?: string;
  serviceType?: string;
  weightLabel: string;
  weightGrams?: number | null;
  isAdditional?: boolean;
  sortOrder?: number;
  rates?: Record<string, string | number>;
  // legacy fixed keys (migrate old snapshots if any)
  local?: string | number;
  withinState?: string | number;
  restOfIndia?: string | number;
  specialLocation?: string | number;
  mumbai?: string | number;
  mah?: string | number;
  raj?: string | number;
  mp?: string | number;
}): RateRowForm {
  const rates: Record<string, number | string> = {};
  if (row.rates && typeof row.rates === 'object') {
    for (const [k, v] of Object.entries(row.rates)) {
      if (v === '' || v === null || v === undefined) rates[k] = '';
      else rates[k] = Number(v);
    }
  } else {
    const legacy = [
      'local',
      'withinState',
      'restOfIndia',
      'specialLocation',
      'mumbai',
      'mah',
      'raj',
      'mp',
    ] as const;
    for (const key of legacy) {
      if (row[key] !== undefined) rates[key] = Number(row[key] ?? 0);
    }
  }

  const sectionId = row.sectionId || row.serviceType || 'section';
  const weightGrams = row.weightGrams ?? null;
  return {
    id: row.id,
    sectionId,
    weightLabel:
      weightGrams != null
        ? weightLabelForGrams(sectionId, weightGrams)
        : row.weightLabel,
    weightGrams,
    isAdditional: Boolean(row.isAdditional),
    sortOrder: row.sortOrder ?? 0,
    rates,
  };
}

export function toMatrixForm(input: {
  columns?: RateColumnDef[];
  sections?: RateSectionDef[];
  rows?: Array<Parameters<typeof toRateRowForm>[0]>;
}): RateMatrixForm {
  const columns = [...(input.columns ?? [])]
    .map((c, i) => ({
      id: c.id,
      label: c.label,
      sortOrder: c.sortOrder ?? i,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sections = [...(input.sections ?? [])]
    .map((s, i) => ({
      id: s.id,
      label: serviceTypeLabel(s.id) || s.label,
      sortOrder: s.sortOrder ?? i,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Drop legacy "Additional Weight" rows
  const rows = (input.rows ?? [])
    .map(toRateRowForm)
    .filter((r) => !r.isAdditional)
    .map((r) => ({
      ...r,
      isAdditional: false,
      weightLabel:
        r.weightGrams != null
          ? weightLabelForGrams(r.sectionId, r.weightGrams)
          : r.weightLabel,
    }));

  // Ensure every row has keys for all columns
  for (const row of rows) {
    for (const col of columns) {
      if (row.rates[col.id] === undefined) row.rates[col.id] = '';
    }
  }

  return { columns, sections, rows };
}

type MatrixRow = {
  sectionId: string;
  weightGrams?: number | null;
  isAdditional?: boolean;
  sortOrder?: number;
  rates: Record<string, string | number>;
};

function sectionRows(
  matrix: { rows?: MatrixRow[] },
  sectionId: string,
): MatrixRow[] {
  const sid = String(sectionId || '').trim();
  return (matrix.rows ?? [])
    .filter(
      (r) =>
        !r.isAdditional &&
        String(r.sectionId || '').trim().toLowerCase() === sid.toLowerCase(),
    )
    .sort(
      (a, b) =>
        Number(a.weightGrams ?? a.sortOrder ?? 0) -
        Number(b.weightGrams ?? b.sortOrder ?? 0),
    );
}

/**
 * Slab pricing:
 * - weight ≤ a band → use that band (next bigger / equal)
 * - weight > max band → ceil(weight / maxBand) × max-band rate
 *   e.g. 1200g with 1000g@13 → 2×13; 4500g → 5×13
 */
function resolveSlabAmount(
  rows: MatrixRow[],
  weightKg: number,
  pickRate: (row: MatrixRow) => { amount: number; columnId: string } | null,
): { amount: number; columnId: string } {
  if (!rows.length) {
    return { amount: 0, columnId: ROI_RATE_COLUMN_ID };
  }

  // Round to avoid float drift (e.g. 100g → 0.1kg → 99.999…g)
  const weightGrams = Math.round(Math.max(0, Number(weightKg || 0) * 1000));
  if (weightGrams <= 0) {
    return { amount: 0, columnId: ROI_RATE_COLUMN_ID };
  }

  const maxBand = Math.max(0, Number(rows[rows.length - 1].weightGrams ?? 0));

  if (maxBand > 0 && weightGrams > maxBand) {
    const multiplier = Math.ceil(weightGrams / maxBand);
    const picked = pickRate(rows[rows.length - 1]);
    if (picked) {
      return {
        amount: picked.amount * multiplier,
        columnId: picked.columnId,
      };
    }
    return { amount: 0, columnId: ROI_RATE_COLUMN_ID };
  }

  // Next bigger (or equal) slab; if that cell is empty, try heavier slabs
  let matchIdx = rows.length - 1;
  for (let i = 0; i < rows.length; i++) {
    const band = Number(rows[i].weightGrams ?? 0);
    if (band > 0 && weightGrams <= band) {
      matchIdx = i;
      break;
    }
  }

  for (let i = matchIdx; i < rows.length; i++) {
    const picked = pickRate(rows[i]);
    if (picked) return picked;
  }

  return { amount: 0, columnId: ROI_RATE_COLUMN_ID };
}

/** Pick freight from a rate matrix using section + column + weight (kg). */
export function lookupMatrixRate(
  matrix: {
    sections?: RateSectionDef[];
    columns?: RateColumnDef[];
    rows?: MatrixRow[];
  },
  opts: {
    sectionId: string;
    columnId: string;
    weightKg: number;
  },
): number {
  const rows = sectionRows(matrix, opts.sectionId);
  return resolveSlabAmount(rows, opts.weightKg, (row) => {
    const raw = row.rates?.[opts.columnId];
    if (!isRateConfigured(raw)) return null;
    return { amount: Number(raw), columnId: opts.columnId };
  }).amount;
}

function candidateColumnIds(
  matrix: { columns?: RateColumnDef[]; rows?: MatrixRow[] },
  opts: {
    receiverCityId?: string | null;
    receiverStateId?: string | null;
    receiverCityName?: string | null;
    receiverStateName?: string | null;
  },
): string[] {
  const columns = matrix.columns ?? [];
  const byId = new Map(columns.map((c) => [c.id, c]));
  const ids: string[] = [];
  const push = (id: string | null | undefined) => {
    if (!id || ids.includes(id)) return;
    ids.push(id);
  };

  if (opts.receiverCityId) push(cityRateColumnId(opts.receiverCityId));

  // Match city column by label if id prefix missing (legacy / renamed)
  if (opts.receiverCityName) {
    const name = opts.receiverCityName.trim().toLowerCase();
    for (const col of columns) {
      if (col.label.trim().toLowerCase() === name) push(col.id);
    }
  }

  if (opts.receiverStateId) push(stateRateColumnId(opts.receiverStateId));

  // City chip named like the state (Gujarat city) used as state-level rate
  if (opts.receiverStateName) {
    const stateName = opts.receiverStateName.trim().toLowerCase();
    for (const col of columns) {
      const label = col.label.trim().toLowerCase();
      if (label === stateName || label === `within ${stateName}`) push(col.id);
    }
  }

  push(ROI_RATE_COLUMN_ID);
  // Also accept legacy restOfIndia key
  push('restOfIndia');

  // Include any id that appears in row rates even if not listed in columns
  for (const id of ids) {
    if (!byId.has(id) && id.startsWith('city:')) {
      // keep — rate may still exist on rows
    }
  }

  return ids;
}

/**
 * City → state → ROI freight resolver for booking.
 * Empty/missing cell falls through columns; explicit 0 is a valid rate.
 * Weight uses next-bigger slab; over max slab multiplies the top rate.
 */
export function resolveRate(
  matrix: {
    columns?: RateColumnDef[];
    rows?: MatrixRow[];
  },
  opts: {
    sectionId: string;
    weightKg: number;
    receiverCityId?: string | null;
    receiverStateId?: string | null;
    receiverCityName?: string | null;
    receiverStateName?: string | null;
  },
): { amount: number; columnId: string } {
  const columnIds = candidateColumnIds(matrix, opts);
  const rows = sectionRows(matrix, opts.sectionId);

  return resolveSlabAmount(rows, opts.weightKg, (row) => {
    for (const columnId of columnIds) {
      const raw = row.rates?.[columnId];
      if (!isRateConfigured(raw)) continue;
      return { amount: Number(raw), columnId };
    }
    return null;
  });
}

export function matrixPayload(matrix: RateMatrixForm) {
  return {
    columns: matrix.columns.map((c, i) => ({
      id: c.id,
      label: c.label.trim() || `Column ${i + 1}`,
      sortOrder: i,
    })),
    sections: matrix.sections.map((s, i) => ({
      id: s.id,
      label: serviceTypeLabel(s.id) || s.label.trim() || `Section ${i + 1}`,
      sortOrder: i,
    })),
    rows: matrix.rows
      .filter((r) => !r.isAdditional)
      .map((r, i) => ({
        id: r.id,
        sectionId: r.sectionId,
        weightLabel:
          r.weightGrams != null
            ? weightLabelForGrams(r.sectionId, r.weightGrams)
            : r.weightLabel.trim() || `Row ${i + 1}`,
        weightGrams: r.weightGrams,
        isAdditional: false,
        sortOrder: r.sortOrder,
        rates: Object.fromEntries(
          Object.entries(r.rates).map(([k, v]) => [
            k,
            v === '' || v === null || v === undefined ? '' : Number(v),
          ]),
        ),
      })),
  };
}
