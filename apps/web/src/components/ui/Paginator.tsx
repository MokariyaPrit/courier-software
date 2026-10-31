'use client';

import { Paginator as PRPaginator } from '@primereact/ui/paginator';
import { Select } from './Select';
import { PAGE_SIZE_OPTIONS } from '@/lib/list';

export interface PaginatorPageChangeEvent {
  first: number;
  rows: number;
  page: number;
}

interface AppPaginatorProps {
  first: number;
  rows: number;
  totalRecords: number;
  rowsPerPageOptions?: number[];
  onPageChange: (e: PaginatorPageChangeEvent) => void;
}

export function Paginator({
  first,
  rows,
  totalRecords,
  rowsPerPageOptions = PAGE_SIZE_OPTIONS.map((o) => o.value),
  onPageChange,
}: AppPaginatorProps) {
  // PrimeReact 11 paginator pages are 1-based.
  const page = Math.floor(first / rows) + 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <PRPaginator.Root
        page={page}
        total={totalRecords}
        itemsPerPage={rows}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onPageChange={(e: any) => {
          const nextPage = Math.max(1, Number(e?.value ?? page));
          onPageChange({
            first: (nextPage - 1) * rows,
            rows,
            page: nextPage - 1,
          });
        }}
      >
        <PRPaginator.Content>
          <PRPaginator.First />
          <PRPaginator.Prev />
          <PRPaginator.Pages />
          <PRPaginator.Next />
          <PRPaginator.Last />
        </PRPaginator.Content>
      </PRPaginator.Root>
      <Select
        value={rows}
        options={rowsPerPageOptions.map((n) => ({
          label: String(n),
          value: n,
        }))}
        onChange={(e) =>
          onPageChange({ first: 0, rows: Number(e.value), page: 0 })
        }
        className="list-page-size"
      />
    </div>
  );
}
