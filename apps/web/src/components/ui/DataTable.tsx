'use client';

import { DataTable as PRDataTable } from '@primereact/ui/datatable';
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
  const rows = value ?? [];

  return (
    <PRDataTable.Root data={rows as object[]} dataKey={dataKey}>
      {loading ? <PRDataTable.Loading /> : null}
      <PRDataTable.TableContainer>
        <PRDataTable.Table>
          <PRDataTable.THead>
            <PRDataTable.THeadRow>
              {columns.map((col) => (
                <PRDataTable.THeadCell key={col.header}>
                  <PRDataTable.THeadTitle>{col.header}</PRDataTable.THeadTitle>
                </PRDataTable.THeadCell>
              ))}
            </PRDataTable.THeadRow>
          </PRDataTable.THead>
          {rows.length === 0 && !loading ? (
            <PRDataTable.EmptyTBody>
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '1rem', textAlign: 'center' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            </PRDataTable.EmptyTBody>
          ) : (
            <PRDataTable.TBody>
              {({ item }: { item: object }) => {
                const row = item as T;
                const key = String(
                  (row as Record<string, unknown>)[dataKey] ?? Math.random(),
                );
                return (
                  <PRDataTable.Row key={key}>
                    {columns.map((col) => {
                      let cell: ReactNode = null;
                      if (col.body) cell = col.body(row);
                      else if (col.field) {
                        cell = String(
                          (row as Record<string, unknown>)[col.field] ?? '',
                        );
                      }
                      return (
                        <PRDataTable.Cell key={col.header} style={col.style}>
                          {cell}
                        </PRDataTable.Cell>
                      );
                    })}
                  </PRDataTable.Row>
                );
              }}
            </PRDataTable.TBody>
          )}
        </PRDataTable.Table>
      </PRDataTable.TableContainer>
    </PRDataTable.Root>
  );
}
