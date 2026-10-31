'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
  Dialog,
  InputText,
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

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name Asc', sortBy: 'name', sortOrder: 'ASC', isDefault: true },
  { label: 'Name Desc', sortBy: 'name', sortOrder: 'DESC' },
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC' },
  { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { label: 'Active first', sortBy: 'isActive', sortOrder: 'DESC' },
];

export default function StatesPage() {
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const listQuery = useQuery({
    queryKey: ['states', list.queryParams],
    queryFn: () => fetchPaginated<StateRow>('/states', list.queryParams),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleaned = trimFormData({ name });
      await api.post('/states', { name: cleaned.name, isActive: true });
    },
    onSuccess: async () => {
      setOpen(false);
      setName('');
      setError('');
      await qc.invalidateQueries({ queryKey: ['states'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to create state';
      setError(message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: StateRow) => {
      await api.patch(`/states/${row.id}`, { isActive: !row.isActive });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['states'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: StateRow) => {
      await api.delete(`/states/${row.id}`);
    },
    onSuccess: async () => {
      setListError('');
      await qc.invalidateQueries({ queryKey: ['states'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to delete state';
      setListError(message);
    },
  });

  const askDelete = (row: StateRow) => {
    confirmDialog({
      header: 'Delete state',
      message: `Remove "${row.name}"? Only allowed if no cities are linked. Soft delete hides it from lists.`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row),
    });
  };

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>States</h1>
        <Button
          label="Add state"
          icon="pi pi-plus"
          onClick={() => {
            setError('');
            setName('');
            setOpen(true);
          }}
        />
      </div>
      <ListSearch
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search state"
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
          onClearFilters={list.clearFilters}
          clearFiltersDisabled={!list.hasActiveFilters}
        >
          <DataTable
            value={listQuery.data?.data ?? []}
            loading={listQuery.isLoading}
            columns={[
              { field: 'name', header: 'State' },
              {
                header: 'Status',
                body: (row: StateRow) => (
                  <Tag severity={row.isActive ? 'success' : 'danger'}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                ),
              },
              {
                header: 'Actions',
                body: (row: StateRow) => (
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
        header="New state"
        visible={open}
        onHide={() => setOpen(false)}
        style={{ width: 420 }}
      >
        <div className="field">
          <label>State name</label>
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%' }}
          />
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
