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
        (a.weightGrams ?? a.sortOrder ?? 0) - (b.weightGrams ?? b.sortOrder ?? 0),
    );
}

/** Rows to try for a weight: matching band first, then lighter bands (with rates). */
function weightRowsToTry(
  matrix: { rows?: MatrixRow[] },
  sectionId: string,
  weightKg: number,
): MatrixRow[] {
  const rows = sectionRows(matrix, sectionId);
  if (!rows.length) return [];

  const weightGrams = Math.max(0, Number(weightKg || 0) * 1000);
  let matchIdx = 0;
  for (let i = 0; i < rows.length; i++) {
    const band = rows[i].weightGrams ?? 0;
    matchIdx = i;
    if (band > 0 && weightGrams <= band) break;
  }

  // Prefer exact band, then walk toward lighter bands that may have rates filled
  const ordered = [rows[matchIdx]];
  for (let i = matchIdx - 1; i >= 0; i--) ordered.push(rows[i]);
  for (let i = matchIdx + 1; i < rows.length; i++) ordered.push(rows[i]);
  return ordered;
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
  for (const row of weightRowsToTry(matrix, opts.sectionId, opts.weightKg)) {
    const raw = row.rates?.[opts.columnId];
    if (isRateConfigured(raw)) return Number(raw);
  }
  return 0;
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
 * Empty/missing cell falls through; explicit 0 is a valid rate.
 * If the weight band cell is empty, lighter/heavier bands in the section are tried.
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
  const rows = weightRowsToTry(matrix, opts.sectionId, opts.weightKg);

  for (const row of rows) {
    for (const columnId of columnIds) {
      const raw = row.rates?.[columnId];
      if (!isRateConfigured(raw)) continue;
      return { amount: Number(raw), columnId };
    }
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
