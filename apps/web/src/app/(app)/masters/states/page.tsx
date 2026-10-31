'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
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

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name Asc', sortBy: 'name', sortOrder: 'ASC' },
  { label: 'Name Desc', sortBy: 'name', sortOrder: 'DESC' },
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC' },
  { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { label: 'Active first', sortBy: 'isActive', sortOrder: 'DESC' },
];

export default function StatesPage() {
  const qc = useQueryClient();
  const list = useListParams({ defaultSort: SORT_OPTIONS[0] });
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
      message: `Delete "${row.name}"? Only allowed if no cities are linked.`,
      icon: 'pi pi-exclamation-triangle',
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
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search state"
        sortKey={list.sortKey}
        onSortChange={list.setSortKey}
        sortOptions={SORT_OPTIONS}
      />
      {listError ? <p className="error-text">{listError}</p> : null}
      <div className="panel">
        <DataTable value={listQuery.data?.data ?? []} loading={listQuery.isLoading}>
          <Column field="name" header="State" />
          <Column
            header="Status"
            body={(row: StateRow) => (
              <Tag
                value={row.isActive ? 'Active' : 'Inactive'}
                severity={row.isActive ? 'success' : 'danger'}
              />
            )}
          />
          <Column
            header="Actions"
            body={(row: StateRow) => (
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
