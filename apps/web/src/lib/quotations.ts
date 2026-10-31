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

  return {
    id: row.id,
    sectionId: row.sectionId || row.serviceType || 'section',
    weightLabel: row.weightLabel,
    weightGrams: row.weightGrams ?? null,
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
      label: s.label,
      sortOrder: s.sortOrder ?? i,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const rows = (input.rows ?? []).map(toRateRowForm);

  // Ensure every row has keys for all columns
  for (const row of rows) {
    for (const col of columns) {
      if (row.rates[col.id] === undefined) row.rates[col.id] = '';
    }
  }

  return { columns, sections, rows };
}

function pickWeightRow(
  matrix: {
    rows?: Array<{
      sectionId: string;
      weightGrams?: number | null;
      isAdditional?: boolean;
      sortOrder?: number;
      rates: Record<string, string | number>;
    }>;
  },
  sectionId: string,
  weightKg: number,
) {
  const weightGrams = Math.max(0, Number(weightKg || 0) * 1000);
  const rows = (matrix.rows ?? [])
    .filter((r) => r.sectionId === sectionId && !r.isAdditional)
    .sort(
      (a, b) =>
        (a.weightGrams ?? a.sortOrder ?? 0) - (b.weightGrams ?? b.sortOrder ?? 0),
    );

  if (!rows.length) return null;

  let match = rows[0];
  for (const row of rows) {
    const band = row.weightGrams ?? 0;
    if (band > 0 && weightGrams <= band) {
      match = row;
      break;
    }
    match = row;
  }
  return match;
}

/** Pick freight from a rate matrix using section + column + weight (kg). */
export function lookupMatrixRate(
  matrix: {
    sections?: RateSectionDef[];
    columns?: RateColumnDef[];
    rows?: Array<{
      sectionId: string;
      weightGrams?: number | null;
      isAdditional?: boolean;
      sortOrder?: number;
      rates: Record<string, string | number>;
    }>;
  },
  opts: {
    sectionId: string;
    columnId: string;
    weightKg: number;
  },
): number {
  const match = pickWeightRow(matrix, opts.sectionId, opts.weightKg);
  if (!match) return 0;
  const raw = match.rates?.[opts.columnId];
  if (!isRateConfigured(raw)) return 0;
  return Number(raw);
}

/**
 * City → state → ROI freight resolver for booking.
 * Empty/missing cell falls through; explicit 0 is a valid rate.
 */
export function resolveRate(
  matrix: {
    columns?: RateColumnDef[];
    rows?: Array<{
      sectionId: string;
      weightGrams?: number | null;
      isAdditional?: boolean;
      sortOrder?: number;
      rates: Record<string, string | number>;
    }>;
  },
  opts: {
    sectionId: string;
    weightKg: number;
    receiverCityId?: string | null;
    receiverStateId?: string | null;
  },
): { amount: number; columnId: string } {
  const columnIds: string[] = [];
  if (opts.receiverCityId) columnIds.push(cityRateColumnId(opts.receiverCityId));
  if (opts.receiverStateId) {
    columnIds.push(stateRateColumnId(opts.receiverStateId));
  }
  columnIds.push(ROI_RATE_COLUMN_ID);

  const colSet = new Set((matrix.columns ?? []).map((c) => c.id));
  const match = pickWeightRow(matrix, opts.sectionId, opts.weightKg);

  for (const columnId of columnIds) {
    if (!colSet.has(columnId)) continue;
    if (!match) continue;
    const raw = match.rates?.[columnId];
    if (!isRateConfigured(raw)) continue;
    return { amount: Number(raw), columnId };
  }

  return { amount: 0, columnId: ROI_RATE_COLUMN_ID };
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
      label: s.label.trim() || `Section ${i + 1}`,
      sortOrder: i,
    })),
    rows: matrix.rows.map((r, i) => ({
      id: r.id,
      sectionId: r.sectionId,
      weightLabel: r.weightLabel.trim() || `Row ${i + 1}`,
      weightGrams: r.weightGrams,
      isAdditional: r.isAdditional,
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
