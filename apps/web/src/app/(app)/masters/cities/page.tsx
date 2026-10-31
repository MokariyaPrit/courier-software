'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
  Dialog,
  InputText,
  Select,
  Tag,
} from '@/components/ui';
import { useState } from 'react';
import { ListFilterChrome, ListSearch } from '@/components/ListControls';
import { api } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import { trimFormData } from '@/lib/trim';

interface StateRow {
  id: string;
  name: string;
  isActive: boolean;
}

interface CityRow {
  id: string;
  name: string;
  stateId: string;
  isActive: boolean;
  state?: StateRow | null;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'City Asc', sortBy: 'name', sortOrder: 'ASC', isDefault: true },
  { label: 'City Desc', sortBy: 'name', sortOrder: 'DESC' },
  { label: 'State Asc', sortBy: 'stateName', sortOrder: 'ASC' },
  { label: 'State Desc', sortBy: 'stateName', sortOrder: 'DESC' },
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC' },
];

export default function CitiesPage() {
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', stateId: '' });
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const statesQuery = useQuery({
    queryKey: ['states', 'dropdown'],
    queryFn: () =>
      fetchPaginated<StateRow>('/states', {
        page: 1,
        pageSize: 200,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
  });

  const listQuery = useQuery({
    queryKey: ['cities', list.queryParams, stateFilter],
    queryFn: () =>
      fetchPaginated<CityRow>('/cities', {
        ...list.queryParams,
        stateId: stateFilter || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleaned = trimFormData(form);
      await api.post('/cities', {
        name: cleaned.name,
        stateId: cleaned.stateId,
        isActive: true,
      });
    },
    onSuccess: async () => {
      setOpen(false);
      setForm({ name: '', stateId: '' });
      setError('');
      await qc.invalidateQueries({ queryKey: ['cities'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to create city';
      setError(message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: CityRow) => {
      await api.patch(`/cities/${row.id}`, { isActive: !row.isActive });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['cities'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: CityRow) => {
      await api.delete(`/cities/${row.id}`);
    },
    onSuccess: async () => {
      setListError('');
      await qc.invalidateQueries({ queryKey: ['cities'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to delete city';
      setListError(message);
    },
  });

  const askDelete = (row: CityRow) => {
    confirmDialog({
      header: 'Delete city',
      message: `Remove "${row.name}"? It will be hidden from lists (soft delete).`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row),
    });
  };

  const stateOptions =
    statesQuery.data?.data.map((s) => ({ label: s.name, value: s.id })) ?? [];

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Cities</h1>
        <Button
          label="Add city"
          icon="pi pi-plus"
          onClick={() => {
            setError('');
            setForm({ name: '', stateId: stateFilter || '' });
            setOpen(true);
          }}
        />
      </div>
      <ListSearch
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search city / state"
        extra={
          <Select
            value={stateFilter}
            options={[{ label: 'All states', value: null }, ...stateOptions]}
            onChange={(e) => {
              setStateFilter(e.value);
              list.setPage(1);
            }}
            placeholder="Filter by state"
            style={{ minWidth: 220 }}
          />
        }
      />
      {listError ? <p className="error-text">{listError}</p> : null}
      <div className="panel">
        <ListFilterChrome
          meta={meta}
          sortOptions={SORT_OPTIONS}
          sortKey={list.sortKey}
          onSortChange={list.setSortKey}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          showClearFilters
          onClearFilters={() => {
            list.clearFilters();
            setStateFilter(null);
          }}
          clearFiltersDisabled={!list.hasActiveFilters && !stateFilter}
        >
          <DataTable
            value={listQuery.data?.data ?? []}
            loading={listQuery.isLoading}
            columns={[
              { field: 'name', header: 'City' },
              {
                header: 'State',
                body: (row: CityRow) => row.state?.name ?? '—',
              },
              {
                header: 'Status',
                body: (row: CityRow) => (
                  <Tag severity={row.isActive ? 'success' : 'danger'}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                ),
              },
              {
                header: 'Actions',
                body: (row: CityRow) => (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      text
                      label={row.isActive ? 'Deactivate' : 'Activate'}
                      onClick={() => toggleMutation.mutate(row)}
                    />
                    <Button
                      size="small"
                      text
                      severity="danger"
                      icon="pi pi-trash"
                      label="Delete"
                      onClick={() => askDelete(row)}
                    />
                  </div>
                ),
              },
            ]}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header="New city"
        visible={open}
        onHide={() => setOpen(false)}
        style={{ width: 480 }}
      >
        <div className="form-grid">
          <div className="field full">
            <label>State</label>
            <Select
              value={form.stateId || null}
              options={stateOptions}
              onChange={(e) => setForm({ ...form, stateId: e.value })}
              placeholder="Select state"
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>City name</label>
            <InputText
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Button
            label="Save"
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          />
        </div>
      </Dialog>
    </div>
  );
}
