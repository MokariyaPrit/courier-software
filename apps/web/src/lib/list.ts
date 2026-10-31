'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';

export const DEFAULT_PAGE_SIZE = 50;
export const SEARCH_DEBOUNCE_MS = 400;
export const PAGE_SIZE_OPTIONS = [
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
];

export type SortDir = 'ASC' | 'DESC';

/** Configurable sort option (Angular SORTING_OPTIONS shape). */
export interface SortOption {
  label: string;
  sortBy: string;
  sortOrder: SortDir;
  isDefault?: boolean;
}

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: ListMeta;
}

export function sortOptionValue(opt: SortOption) {
  return `${opt.sortBy}:${opt.sortOrder}`;
}

export function parseSort(
  value: string,
  fallback: SortOption,
): Pick<SortOption, 'sortBy' | 'sortOrder'> {
  const [sortBy, sortOrder] = value.split(':');
  if (!sortBy || (sortOrder !== 'ASC' && sortOrder !== 'DESC')) {
    return { sortBy: fallback.sortBy, sortOrder: fallback.sortOrder };
  }
  return { sortBy, sortOrder };
}

export function findSortOption(
  options: SortOption[],
  value: string,
): SortOption | undefined {
  return options.find((o) => sortOptionValue(o) === value);
}

export function defaultSortOption(options: SortOption[]): SortOption {
  return options.find((o) => o.isDefault) ?? options[0];
}

export function useListParams(options: {
  defaultSort?: SortOption;
  sortOptions?: SortOption[];
  pageSize?: number;
  searchDebounceMs?: number;
}) {
  const fallback = useMemo(() => {
    if (options.sortOptions?.length) {
      return defaultSortOption(options.sortOptions);
    }
    if (options.defaultSort) return options.defaultSort;
    throw new Error('useListParams requires defaultSort or sortOptions');
  }, [options.defaultSort, options.sortOptions]);

  const debounceMs = options.searchDebounceMs ?? SEARCH_DEBOUNCE_MS;
  const defaultPageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const [sortKey, setSortKeyState] = useState(sortOptionValue(fallback));
  /** Immediate input value (updates every keystroke). */
  const [search, setSearchState] = useState('');
  /** Debounced value used for API queries. */
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debouncedSearchRef = useRef(debouncedSearch);
  debouncedSearchRef.current = debouncedSearch;

  useEffect(() => {
    const next = search.trim();
    const timer = window.setTimeout(() => {
      if (debouncedSearchRef.current === next) return;
      setDebouncedSearch(next);
      setPage(1);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [search, debounceMs]);

  const sort = parseSort(sortKey, fallback);
  const selectedSort = findSortOption(options.sortOptions ?? [fallback], sortKey) ?? {
    ...fallback,
    ...sort,
    label: fallback.label,
  };

  const setPageSize = (next: number) => {
    setPageSizeState(next);
    setPage(1);
  };

  const setSortKey = (next: string) => {
    setSortKeyState(next);
    setPage(1);
  };

  const setSort = (next: SortOption) => {
    setSortKey(sortOptionValue(next));
  };

  const setSearch = (next: string) => {
    setSearchState(next);
  };

  const clearFilters = () => {
    setSearchState('');
    setDebouncedSearch('');
    setSortKeyState(sortOptionValue(fallback));
    setPage(1);
  };

  const queryParams = {
    page,
    pageSize,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
    search: debouncedSearch || undefined,
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(debouncedSearch) ||
    sortOptionValue(fallback) !== sortKey;

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    sortKey,
    setSortKey,
    setSort,
    selectedSort,
    search,
    setSearch,
    debouncedSearch,
    sort,
    queryParams,
    clearFilters,
    hasActiveFilters,
    defaultSort: fallback,
  };
}
export async function fetchPaginated<T>(
  url: string,
  params: Record<string, unknown>,
): Promise<Paginated<T>> {
  const res = await api.get(url, { params });
  const body = res.data as { data?: T[]; meta?: ListMeta };
  const data = Array.isArray(body?.data) ? body.data : [];
  const meta: ListMeta = body?.meta ?? {
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || DEFAULT_PAGE_SIZE,
    total: data.length,
  };
  return { data, meta };
}

export function rangeLabel(meta: ListMeta) {
  if (!meta.total) return 'Showing: 0 to 0 of 0';
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return `Showing: ${from} to ${to} of ${meta.total}`;
}
