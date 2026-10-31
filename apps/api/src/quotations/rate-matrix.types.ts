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

export type RateRowData = {
  id?: string;
  sectionId: string;
  weightLabel: string;
  weightGrams?: number | null;
  isAdditional?: boolean;
  sortOrder: number;
  /** columnId -> rate value */
  rates: Record<string, string | number>;
};

export type RateMatrix = {
  columns: RateColumnDef[];
  sections: RateSectionDef[];
  rows: RateRowData[];
};
