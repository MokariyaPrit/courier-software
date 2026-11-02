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

interface AppDataTableProps<T> {
  value: T[];
  columns: AppColumn<T>[];
  loading?: boolean;
  emptyMessage?: string;
  dataKey?: keyof T & string;
}

export function DataTable<T>({
  value,
  columns,
  loading,
  emptyMessage = 'No records found',
  dataKey = 'id' as keyof T & string,
}: AppDataTableProps<T>) {
  return (
    <PRDataTable
      value={(value ?? []) as object[]}
      loading={loading}
      emptyMessage={emptyMessage}
      dataKey={dataKey}
    >
      {columns.map((col, index) => (
        <Column
          key={`${String(col.field || 'col')}-${col.header}-${index}`}
          field={col.field}
          header={col.header}
          body={col.body as ((row: object) => ReactNode) | undefined}
          style={col.style}
        />
      ))}
    </PRDataTable>
  );
}
