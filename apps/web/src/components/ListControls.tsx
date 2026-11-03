'use client';

import { Dropdown } from 'primereact/dropdown';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import {
  Paginator,
  type PaginatorPageChangeEvent,
} from 'primereact/paginator';
import type { ReactNode } from 'react';
import { Button, InputText } from '@/components/ui';
import {
  findSortOption,
  ListMeta,
  PAGE_SIZE_OPTIONS,
  rangeLabel,
  SortOption,
  sortOptionValue,
} from '@/lib/list';

/* -------------------------------------------------------------------------- */
/* Sort by select                                                             */
/* -------------------------------------------------------------------------- */

interface SortBySelectProps {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function SortBySelect({
  value,
  options,
  onChange,
  className,
  placeholder,
}: SortBySelectProps) {
  const selected = findSortOption(options, value);
  const dropdownIcon =
    selected?.sortOrder === 'DESC' ? 'pi pi-arrow-down' : 'pi pi-arrow-up';

  return (
    <Dropdown
      value={value}
      options={options.map((o) => ({
        ...o,
        value: sortOptionValue(o),
      }))}
      optionLabel="label"
      optionValue="value"
      dropdownIcon={dropdownIcon}
      className={`sort-by-select ${className ?? ''}`.trim()}
      panelClassName="sort-by-panel"
      appendTo={typeof document !== 'undefined' ? document.body : undefined}
      placeholder={placeholder ? `Sort by : ${placeholder}` : 'Sort by'}
      valueTemplate={(option) => (
        <span className="sort-by-label">
          Sort by : {option?.label ?? selected?.label ?? placeholder ?? '—'}
        </span>
      )}
      itemTemplate={(option) => (
        <span className="sort-by-item">
          {option.label}
          <i
            className={
              option.sortOrder === 'DESC' ? 'pi pi-arrow-down' : 'pi pi-arrow-up'
            }
          />
        </span>
      )}
      onChange={(e) => {
        if (e.value != null) onChange(String(e.value));
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Search row                                                                 */
/* -------------------------------------------------------------------------- */

interface ListSearchProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  extra?: ReactNode;
}

export function ListSearch({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  extra,
}: ListSearchProps) {
  return (
    <div className="toolbar list-toolbar">
      <IconField iconPosition="left" className="list-search">
        <InputIcon className="pi pi-search" />
        <InputText
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </IconField>
      {extra}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Filter bar                                                                 */
/* -------------------------------------------------------------------------- */

export interface ListFilterBarProps {
  meta: ListMeta;
  sortOptions: SortOption[];
  sortKey: string;
  onSortChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  showPageSize?: boolean;
  showSort?: boolean;
  sortPlaceholder?: string;
  showClearFilters?: boolean;
  clearFiltersLabel?: string;
  onClearFilters?: () => void;
  clearFiltersDisabled?: boolean;
  actions?: ReactNode;
  className?: string;
}

export function ListFilterBar({
  meta,
  sortOptions,
  sortKey,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  showPageSize = true,
  showSort = true,
  sortPlaceholder,
  showClearFilters = false,
  clearFiltersLabel = 'Clear Filters',
  onClearFilters,
  clearFiltersDisabled,
  actions,
  className,
}: ListFilterBarProps) {
  const first = (meta.page - 1) * meta.pageSize;
  const hasRows = meta.total > 0;

  const handlePage = (e: PaginatorPageChangeEvent) => {
    onPageChange(Math.floor(e.first / e.rows) + 1);
  };

  return (
    <div className={`list-filter-bar ${className ?? ''}`.trim()}>
      <div className="list-filter-bar__left">
        <span className="list-count">{rangeLabel(meta)}</span>
        {showSort && sortOptions.length > 0 ? (
          <>
            <span className="list-filter-bar__divider" aria-hidden />
            <SortBySelect
              value={sortKey}
              options={sortOptions}
              onChange={onSortChange}
              placeholder={sortPlaceholder}
            />
          </>
        ) : null}
      </div>

      <div className="list-filter-bar__center">
        {hasRows ? (
          <>
            <Paginator
              first={first}
              rows={meta.pageSize}
              totalRecords={meta.total}
              onPageChange={handlePage}
              template="PrevPageLink PageLinks NextPageLink"
              className="list-filter-paginator"
            />
            {showPageSize && onPageSizeChange ? (
              <div className="list-page-size">
                <span className="list-page-size__label">Rows</span>
                <Dropdown
                  value={meta.pageSize}
                  options={PAGE_SIZE_OPTIONS}
                  optionLabel="label"
                  optionValue="value"
                  className="list-page-size__dropdown"
                  onChange={(e) => {
                    if (e.value != null) onPageSizeChange(Number(e.value));
                  }}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="list-filter-bar__right">
        {showClearFilters && onClearFilters ? (
          <Button
            type="button"
            label={clearFiltersLabel}
            outlined
            severity="secondary"
            className="list-filter-clear"
            disabled={clearFiltersDisabled}
            onClick={onClearFilters}
          />
        ) : null}
        {actions}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Top + bottom bars around table                                             */
/* -------------------------------------------------------------------------- */

export function ListFilterChrome({
  children,
  ...barProps
}: ListFilterBarProps & { children: ReactNode }) {
  return (
    <div className="list-filter-chrome">
      <ListFilterBar {...barProps} className="list-filter-bar--top" />
      <div className="list-filter-chrome__body">{children}</div>
      <ListFilterBar {...barProps} className="list-filter-bar--bottom" />
    </div>
  );
}
