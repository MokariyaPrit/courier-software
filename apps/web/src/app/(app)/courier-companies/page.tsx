'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
  Dialog,
  InputText,
  Tag,
  ToggleSwitch,
  type AppColumn,
} from '@/components/ui';
import { useMemo, useState } from 'react';
import { ListFilterChrome, ListSearch } from '@/components/ListControls';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import { trimFormData } from '@/lib/trim';

interface CourierCompanyOwner {
  id?: string;
  email?: string;
  userInfo?: { fullName?: string | null } | null;
}

interface CourierCompany {
  id: string;
  name: string;
  companyLink: string | null;
  isActive: boolean;
  isShared?: boolean;
  createdById?: string | null;
  createdBy?: CourierCompanyOwner | null;
  isHiddenForMe?: boolean;
  isDefaultForMe?: boolean;
}

type Form = {
  name: string;
  companyLink: string;
  isActive: boolean;
};

const EMPTY: Form = {
  name: '',
  companyLink: '',
  isActive: true,
};

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name Asc', sortBy: 'name', sortOrder: 'ASC', isDefault: true },
  { label: 'Name Desc', sortBy: 'name', sortOrder: 'DESC' },
  { label: 'Active first', sortBy: 'isActive', sortOrder: 'DESC' },
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC' },
];

function toForm(row: CourierCompany): Form {
  return {
    name: row.name || '',
    companyLink: row.companyLink || '',
    isActive: row.isActive,
  };
}

function isSharedCompany(row: CourierCompany) {
  return row.isShared === true || row.createdById == null;
}

export default function CourierCompaniesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState('');

  const canMutate = (row: CourierCompany) => {
    if (user?.role === Role.ADMIN) return true;
    if (isSharedCompany(row)) return false;
    return row.createdById === user?.id;
  };

  const invalidateLists = async () => {
    await qc.invalidateQueries({ queryKey: ['courier-companies'] });
    await qc.invalidateQueries({ queryKey: ['courier-companies-booking'] });
  };

  const listQuery = useQuery({
    queryKey: ['courier-companies', list.queryParams],
    queryFn: () =>
      fetchPaginated<CourierCompany>('/courier-companies', list.queryParams),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleaned = trimFormData(form);
      if (!cleaned.name.trim()) throw new Error('Name is required');
      const payload = {
        name: cleaned.name.trim(),
        companyLink: cleaned.companyLink.trim() || undefined,
        isActive: cleaned.isActive,
      };
      if (editingId) {
        await api.patch(`/courier-companies/${editingId}`, payload);
      } else {
        await api.post('/courier-companies', payload);
      }
    },
    onSuccess: async () => {
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY);
      setError('');
      await invalidateLists();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error && !('response' in err)
          ? err.message
          : (err as { response?: { data?: { error?: { message?: string } } } })
              ?.response?.data?.error?.message || 'Failed to save courier company';
      setError(message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: CourierCompany) => {
      await api.patch(`/courier-companies/${row.id}`, {
        isActive: !row.isActive,
      });
    },
    onSuccess: invalidateLists,
  });

  const prefsMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      isHidden?: boolean;
      isDefault?: boolean;
    }) => {
      await api.put(`/courier-companies/${args.id}/my-prefs`, {
        isHidden: args.isHidden,
        isDefault: args.isDefault,
      });
    },
    onSuccess: invalidateLists,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/courier-companies/${id}`);
    },
    onSuccess: invalidateLists,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError('');
    setOpen(true);
  };

  const openEdit = (row: CourierCompany) => {
    if (!canMutate(row)) return;
    setEditingId(row.id);
    setForm(toForm(row));
    setError('');
    setOpen(true);
  };

  const askDelete = (row: CourierCompany) => {
    if (!canMutate(row)) return;
    confirmDialog({
      header: 'Delete courier company',
      message: `Remove "${row.name}"? It will be hidden from lists (soft delete).`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row.id),
    });
  };

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  const columns = useMemo((): AppColumn<CourierCompany>[] => {
    const cols: AppColumn<CourierCompany>[] = [
      { field: 'name', header: 'Name' },
      {
        header: 'Company link',
        body: (row) =>
          row.companyLink ? (
            <a href={row.companyLink} target="_blank" rel="noreferrer">
              {row.companyLink}
            </a>
          ) : (
            '—'
          ),
      },
      {
        header: 'Scope',
        body: (row) => (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {isSharedCompany(row) ? (
              <Tag severity="info">Shared</Tag>
            ) : (
              <Tag severity="secondary">Mine</Tag>
            )}
            {row.isDefaultForMe ? <Tag severity="success">Default</Tag> : null}
            {row.isHiddenForMe ? <Tag severity="warn">Hidden</Tag> : null}
          </div>
        ),
      },
      {
        header: 'Status',
        body: (row) => (
          <Tag severity={row.isActive ? 'success' : 'danger'}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Tag>
        ),
      },
    ];

    if (user?.role === Role.ADMIN) {
      cols.push({
        header: 'Owner',
        body: (row) =>
          row.createdBy?.userInfo?.fullName || row.createdBy?.email || '—',
      });
    }

    cols.push({
      header: 'Actions',
      body: (row) => {
        const shared = isSharedCompany(row);
        const mutable = canMutate(row);
        return (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {shared ? (
              <Button
                size="small"
                text
                label={row.isHiddenForMe ? 'Show in booking' : 'Hide from me'}
                onClick={() =>
                  prefsMutation.mutate({
                    id: row.id,
                    isHidden: !row.isHiddenForMe,
                  })
                }
              />
            ) : null}
            {row.isActive && !row.isHiddenForMe ? (
              <Button
                size="small"
                text
                label={row.isDefaultForMe ? 'Clear default' : 'Set default'}
                onClick={() =>
                  prefsMutation.mutate({
                    id: row.id,
                    isDefault: !row.isDefaultForMe,
                  })
                }
              />
            ) : null}
            {mutable ? (
              <>
                <Button
                  size="small"
                  text
                  icon="pi pi-pencil"
                  label="Edit"
                  onClick={() => openEdit(row)}
                />
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
              </>
            ) : null}
          </div>
        );
      },
    });

    return cols;
  }, [user?.role, user?.id, toggleMutation, prefsMutation]);

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Courier companies</h1>
        <Button label="Add company" icon="pi pi-plus" onClick={openCreate} />
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Shared admin companies appear for everyone. Hide any you do not need, and
        set one default so new bookings prefill it.
      </p>

      <ListSearch
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search name / link…"
      />

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
            emptyMessage="No courier companies yet"
            columns={columns}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header={editingId ? 'Edit courier company' : 'New courier company'}
        visible={open}
        onHide={() => setOpen(false)}
        style={{ width: 'min(480px, 96vw)' }}
      >
        <div className="form-grid">
          <div className="field full">
            <label>Name</label>
            <InputText
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label>Company link</label>
            <InputText
              value={form.companyLink}
              onChange={(e) =>
                setForm((p) => ({ ...p, companyLink: e.target.value }))
              }
              placeholder="https://…"
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Active</label>
            <ToggleSwitch
              checked={form.isActive}
              onChange={(e) =>
                setForm((p) => ({ ...p, isActive: Boolean(e.value) }))
              }
            />
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <Button
            label="Cancel"
            severity="secondary"
            text
            onClick={() => setOpen(false)}
          />
          <Button
            label={editingId ? 'Update' : 'Save'}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          />
        </div>
      </Dialog>
    </div>
  );
}
