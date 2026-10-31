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
  rates: Record<string, number>;
};

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

export function emptyRatesForColumns(columns: RateColumnDef[]): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const col of columns) rates[col.id] = 0;
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
  const rates: Record<string, number> = {};
  if (row.rates && typeof row.rates === 'object') {
    for (const [k, v] of Object.entries(row.rates)) {
      rates[k] = Number(v ?? 0);
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
      if (row.rates[col.id] === undefined) row.rates[col.id] = 0;
    }
  }

  return { columns, sections, rows };
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
        Object.entries(r.rates).map(([k, v]) => [k, Number(v ?? 0)]),
      ),
    })),
  };
}
