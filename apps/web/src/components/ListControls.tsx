'use client';

import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Paginator, PaginatorPageChangeEvent } from 'primereact/paginator';
import type { ReactNode } from 'react';
import {
  ListMeta,
  PAGE_SIZE_OPTIONS,
  rangeLabel,
  SortOption,
  sortOptionValue,
} from '@/lib/list';

interface ListToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  sortKey: string;
  onSortChange: (value: string) => void;
  sortOptions: SortOption[];
  extra?: ReactNode;
}

/** Search + sort dropdown — pass page-specific sortOptions */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  sortKey,
  onSortChange,
  sortOptions,
  extra,
}: ListToolbarProps) {
  const options = sortOptions.map((opt) => ({
    label: opt.label,
    value: sortOptionValue(opt),
  }));

  return (
    <div className="toolbar list-toolbar">
      {onSearchChange ? (
        <span className="p-input-icon-left list-search">
          <i className="pi pi-search" />
          <InputText
            placeholder={searchPlaceholder}
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </span>
      ) : null}
      <Dropdown
        value={sortKey}
        options={options}
        onChange={(e) => onSortChange(e.value)}
        placeholder="Sort by"
        className="list-sort"
      />
      {extra}
    </div>
  );
}

interface ListPaginatorProps {
  meta: ListMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** Server-side paginator with count + page size */
export function ListPaginator({
  meta,
  onPageChange,
  onPageSizeChange,
}: ListPaginatorProps) {
  const first = (meta.page - 1) * meta.pageSize;

  const handleChange = (e: PaginatorPageChangeEvent) => {
    if (e.rows !== meta.pageSize) {
      onPageSizeChange(e.rows);
      return;
    }
    onPageChange(Math.floor(e.first / e.rows) + 1);
  };

  return (
    <div className="list-paginator">
      <span className="list-count muted">{rangeLabel(meta)}</span>
      <Paginator
        first={first}
        rows={meta.pageSize}
        totalRecords={meta.total}
        rowsPerPageOptions={PAGE_SIZE_OPTIONS.map((o) => o.value)}
        onPageChange={handleChange}
        template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      />
    </div>
  );
}
