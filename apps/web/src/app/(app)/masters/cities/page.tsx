'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { useState } from 'react';
import { ListPaginator, ListToolbar } from '@/components/ListControls';
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
  { label: 'City Asc', sortBy: 'name', sortOrder: 'ASC' },
  { label: 'City Desc', sortBy: 'name', sortOrder: 'DESC' },
  { label: 'State Asc', sortBy: 'stateName', sortOrder: 'ASC' },
  { label: 'State Desc', sortBy: 'stateName', sortOrder: 'DESC' },
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC' },
];

export default function CitiesPage() {
  const qc = useQueryClient();
  const list = useListParams({ defaultSort: SORT_OPTIONS[0] });
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
      message: `Delete "${row.name}"?`,
      icon: 'pi pi-exclamation-triangle',
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
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search city / state"
        sortKey={list.sortKey}
        onSortChange={list.setSortKey}
        sortOptions={SORT_OPTIONS}
        extra={
          <Dropdown
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
        <DataTable value={listQuery.data?.data ?? []} loading={listQuery.isLoading}>
          <Column field="name" header="City" />
          <Column
            header="State"
            body={(row: CityRow) => row.state?.name ?? '—'}
          />
          <Column
            header="Status"
            body={(row: CityRow) => (
              <Tag
                value={row.isActive ? 'Active' : 'Inactive'}
                severity={row.isActive ? 'success' : 'danger'}
              />
            )}
          />
          <Column
            header="Actions"
            body={(row: CityRow) => (
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
            )}
          />
        </DataTable>
        <ListPaginator
          meta={meta}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
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
            <Dropdown
              value={form.stateId || null}
              options={stateOptions}
              onChange={(e) => setForm({ ...form, stateId: e.value })}
              placeholder="Select state"
              filter
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
