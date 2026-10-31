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
  ToggleSwitch,
  type AppColumn,
} from '@/components/ui';
import { useMemo, useState } from 'react';
import { ListFilterChrome, ListSearch } from '@/components/ListControls';
import { RateMatrixEditor } from '@/components/RateMatrixEditor';
import { api, unwrap } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import {
  matrixPayload,
  RateMatrixForm,
  toMatrixForm,
} from '@/lib/quotations';

interface TemplateListItem {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

interface TemplateDetail extends TemplateListItem {
  columns?: RateMatrixForm['columns'];
  sections?: RateMatrixForm['sections'];
  rows?: RateMatrixForm['rows'];
}

const EMPTY_MATRIX: RateMatrixForm = { columns: [], sections: [], rows: [] };

const SORT_OPTIONS: SortOption[] = [
  { label: 'Name Asc', sortBy: 'name', sortOrder: 'ASC', isDefault: true },
  { label: 'Name Desc', sortBy: 'name', sortOrder: 'DESC' },
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC' },
];

export default function QuotationTemplatesPage() {
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('Default contract rates');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [matrix, setMatrix] = useState<RateMatrixForm>(EMPTY_MATRIX);
  const [error, setError] = useState('');

  const listQuery = useQuery({
    queryKey: ['quotation-templates', list.queryParams],
    queryFn: () =>
      fetchPaginated<TemplateListItem>('/quotation-templates', list.queryParams),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/quotation-templates', {
        name: createName.trim(),
        seedDefaultBands: true,
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setCreateName('Default contract rates');
      await qc.invalidateQueries({ queryKey: ['quotation-templates'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to create template';
      setError(message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      await api.patch(`/quotation-templates/${editId}`, {
        name: editName.trim(),
        isActive: editActive,
        ...matrixPayload(matrix),
      });
    },
    onSuccess: async () => {
      setEditId(null);
      setError('');
      await qc.invalidateQueries({ queryKey: ['quotation-templates'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to save template';
      setError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/quotation-templates/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['quotation-templates'] });
    },
  });

  const openEdit = async (row: TemplateListItem) => {
    setError('');
    setEditId(row.id);
    setEditName(row.name);
    setEditActive(row.isActive);
    setMatrix(EMPTY_MATRIX);
    try {
      const res = await api.get(`/quotation-templates/${row.id}`);
      const detail = unwrap<TemplateDetail>(res.data);
      setEditName(detail.name);
      setEditActive(detail.isActive);
      setMatrix(
        toMatrixForm({
          columns: detail.columns,
          sections: detail.sections,
          rows: detail.rows,
        }),
      );
    } catch {
      setError('Failed to load template');
    }
  };

  const askDelete = (row: TemplateListItem) => {
    confirmDialog({
      header: 'Delete template',
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

  const tableColumns = useMemo((): AppColumn<TemplateListItem>[] => {
    return [
      { field: 'name', header: 'Name' },
      {
        header: 'Status',
        body: (row) => (
          <Tag severity={row.isActive ? 'success' : 'danger'}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Tag>
        ),
      },
      {
        header: 'Actions',
        body: (row) => (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <Button
              size="small"
              text
              icon="pi pi-pencil"
              label="Edit rates"
              onClick={() => openEdit(row)}
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
    ];
  }, []);

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Rate templates</h1>
        <Button
          label="New template"
          icon="pi pi-plus"
          onClick={() => {
            setError('');
            setCreateOpen(true);
          }}
        />
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Columns follow your Rate columns selection (cities + ROI). Edit cell
        amounts; add or remove weight rows and sections as needed.
      </p>
      <ListSearch
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search templates"
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
            columns={tableColumns}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header="New rate template"
        visible={createOpen}
        onHide={() => setCreateOpen(false)}
        style={{ width: 'min(420px, 95vw)' }}
      >
        <div className="field">
          <label>Template name</label>
          <InputText
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <p className="muted">
          Seeds default sections and weight bands with columns from your Rate
          columns selection (cities + ROI).
        </p>
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
            onClick={() => setCreateOpen(false)}
          />
          <Button
            label="Create"
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            disabled={!createName.trim()}
          />
        </div>
      </Dialog>

      <Dialog
        header="Edit rate template"
        visible={Boolean(editId)}
        onHide={() => setEditId(null)}
        style={{ width: 'min(1100px, 96vw)' }}
      >
        <div className="form-grid" style={{ marginBottom: '1rem' }}>
          <div className="field">
            <label>Name</label>
            <InputText
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field account-status-row">
            <div>
              <label>Active</label>
            </div>
            <ToggleSwitch
              checked={editActive}
              onChange={(e) => setEditActive(Boolean(e.value))}
            />
          </div>
        </div>
        <RateMatrixEditor value={matrix} onChange={setMatrix} />
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
            onClick={() => setEditId(null)}
          />
          <Button
            label="Save rates"
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            disabled={!editName.trim()}
          />
        </div>
      </Dialog>
    </div>
  );
}
