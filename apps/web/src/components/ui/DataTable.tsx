'use client';

import { Column } from 'primereact/column';
import { DataTable as PRDataTable } from 'primereact/datatable';
import type { ReactNode } from 'react';

export interface AppColumn<T> {
  field?: keyof T & string;
  header: string;
  body?: (row: T) => ReactNode;
  style?: React.CSSProperties;
}

interface AppDataTableProps<T extends object> {
  value: T[];
  columns: AppColumn<T>[];
  loading?: boolean;
  emptyMessage?: string;
  dataKey?: keyof T & string;
  /** Enable checkbox multi-select (PrimeReact selection). */
  selection?: T[];
  onSelectionChange?: (rows: T[]) => void;
}

export function DataTable<T extends object>({
  value,
  columns,
  loading,
  emptyMessage = 'No records found',
  dataKey = 'id' as keyof T & string,
  selection,
  onSelectionChange,
}: AppDataTableProps<T>) {
  const selectable = typeof onSelectionChange === 'function';
  const rows = (value ?? []) as T[];

  if (!selectable) {
    return (
      <PRDataTable
        value={rows}
        loading={loading}
        emptyMessage={emptyMessage}
        dataKey={dataKey as string}
      >
        {columns.map((col, index) => (
          <Column
            key={`${String(col.field || 'col')}-${col.header}-${index}`}
            field={col.field}
            header={col.header}
            body={col.body as ((row: T) => ReactNode) | undefined}
            style={col.style}
          />
        ))}
      </PRDataTable>
    );
  }

  return (
    <PRDataTable
      value={rows}
      loading={loading}
      emptyMessage={emptyMessage}
      dataKey={dataKey as string}
      selection={selection ?? []}
      onSelectionChange={(e) => {
        const next = Array.isArray(e.value) ? (e.value as T[]) : [];
        onSelectionChange(next);
      }}
      selectionMode="checkbox"
      metaKeySelection={false}
    >
      <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
      {columns.map((col, index) => (
        <Column
          key={`${String(col.field || 'col')}-${col.header}-${index}`}
          field={col.field}
          header={col.header}
          body={col.body as ((row: T) => ReactNode) | undefined}
          style={col.style}
        />
      ))}
    </PRDataTable>
  );
}
