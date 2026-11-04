'use client';

import { BOOKING_TYPE_LABELS, BookingType } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
  DataTable,
  Dialog,
  Select,
  type AppColumn,
} from '@/components/ui';
import { useMemo, useState } from 'react';
import { BookingFormPanel } from '@/components/bookings/BookingFormPanel';
import { ListFilterChrome, ListSearch } from '@/components/ListControls';
import { api, unwrap } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import { serviceTypeLabel } from '@/lib/quotations';

interface BookingRow {
  id: string;
  awb: string;
  bookingType: BookingType;
  bookingDate?: string | null;
  receiverName: string;
  receiverPhone?: string | null;
  receiverCity?: string | null;
  receiverState?: string | null;
  receiverAddress?: string | null;
  rateSectionId?: string | null;
  weightKg?: string | number | null;
  price?: string | number | null;
  basePrice?: string | number | null;
  cgst?: string | number | null;
  sgst?: string | number | null;
  igst?: string | number | null;
  remarks?: string | null;
  partyName?: string | null;
  customer?: { name?: string | null } | null;
  courierCompany?: { name?: string | null } | null;
  createdAt: string;
}

const SORT_OPTIONS: SortOption[] = [
  {
    label: 'Newest first',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    isDefault: true,
  },
  { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { label: 'Booking date Desc', sortBy: 'bookingDate', sortOrder: 'DESC' },
  { label: 'Booking date Asc', sortBy: 'bookingDate', sortOrder: 'ASC' },
  { label: 'Doc No Asc', sortBy: 'awb', sortOrder: 'ASC' },
  { label: 'Doc No Desc', sortBy: 'awb', sortOrder: 'DESC' },
  { label: 'Receiver Asc', sortBy: 'receiverName', sortOrder: 'ASC' },
];

const TYPE_FILTER_OPTIONS = [
  { label: 'All types', value: '' },
  { label: BOOKING_TYPE_LABELS[BookingType.ACCOUNT], value: BookingType.ACCOUNT },
  { label: BOOKING_TYPE_LABELS[BookingType.CASH], value: BookingType.CASH },
];

function money(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function bookingTotal(row: BookingRow) {
  const price = Number(row.price ?? 0);
  const base = Number(row.basePrice ?? 0);
  const tax =
    Number(row.cgst ?? 0) + Number(row.sgst ?? 0) + Number(row.igst ?? 0);
  if (tax <= 0) return price;
  if (base > 0 && Math.abs(price - (base + tax)) < 0.05) return price;
  return roundMoney(price + tax);
}

function weightGrams(value: string | number | null | undefined) {
  const kg = Number(value ?? 0);
  if (!Number.isFinite(kg)) return '—';
  return String(Math.round(kg * 1000));
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}-${mm}-${yyyy}`;
  }
  return raw;
}

export default function BookingListPage() {
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [bookingType, setBookingType] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<BookingType>(BookingType.ACCOUNT);
  const [editAwb, setEditAwb] = useState('');

  const openEdit = (row: Pick<BookingRow, 'id' | 'bookingType' | 'awb'>) => {
    setViewId(null);
    setEditMode(row.bookingType || BookingType.ACCOUNT);
    setEditAwb(row.awb || '');
    setEditId(row.id);
  };

  const closeEdit = () => {
    setEditId(null);
    setEditAwb('');
  };

  const listQuery = useQuery({
    queryKey: ['booking-list', list.queryParams, bookingType],
    queryFn: () =>
      fetchPaginated<BookingRow>('/consignments', {
        ...list.queryParams,
        ...(bookingType ? { bookingType } : {}),
        mine: true,
      }),
  });

  const viewQuery = useQuery({
    queryKey: ['booking-list-detail', viewId],
    enabled: Boolean(viewId),
    queryFn: async () => {
      const res = await api.get(`/consignments/${viewId}`);
      return unwrap<BookingRow>(res.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/consignments/${id}`);
    },
    onSuccess: async (_data, id) => {
      if (viewId === id) setViewId(null);
      if (editId === id) closeEdit();
      await qc.invalidateQueries({ queryKey: ['booking-list'] });
      await qc.invalidateQueries({ queryKey: ['consignments-recent'] });
      await qc.invalidateQueries({ queryKey: ['consignments'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
    },
  });

  const askDelete = (row: BookingRow) => {
    confirmDialog({
      header: 'Delete booking',
      message: `Delete booking ${row.awb}? Bookings already on an invoice cannot be deleted.`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row.id),
    });
  };

  const clearAll = () => {
    list.clearFilters();
    setBookingType('');
  };

  const hasExtraFilters = Boolean(bookingType);
  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  const detail = viewQuery.data;
  const columns = useMemo((): AppColumn<BookingRow>[] => {
    return [
      {
        field: 'awb',
        header: 'Doc No',
        body: (row) => (
          <button
            type="button"
            className="booking-recent-awb"
            onClick={() => setViewId(row.id)}
          >
            {row.awb}
          </button>
        ),
      },
      {
        header: 'Date',
        body: (row) => formatDate(row.bookingDate),
      },
      {
        header: 'Type',
        body: (row) =>
          BOOKING_TYPE_LABELS[row.bookingType] || row.bookingType,
      },
      {
        header: 'Party',
        body: (row) => row.customer?.name || row.partyName || '—',
      },
      { field: 'receiverName', header: 'Receiver' },
      {
        header: 'Destination',
        body: (row) =>
          [row.receiverCity, row.receiverState].filter(Boolean).join(', ') ||
          '—',
      },
      {
        header: 'Service',
        body: (row) =>
          row.rateSectionId ? serviceTypeLabel(row.rateSectionId) : '—',
      },
      {
        header: 'Wt (g)',
        body: (row) => weightGrams(row.weightKg),
      },
      {
        header: 'Amount',
        body: (row) => `₹${money(bookingTotal(row))}`,
      },
      {
        header: '',
        body: (row) => (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <Button
              icon="pi pi-eye"
              text
              rounded
              aria-label="View"
              onClick={() => setViewId(row.id)}
            />
            <Button
              icon="pi pi-pencil"
              text
              rounded
              aria-label="Edit"
              onClick={() => openEdit(row)}
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              aria-label="Delete"
              disabled={deleteMutation.isPending}
              onClick={() => askDelete(row)}
            />
          </div>
        ),
      },
    ];
  }, [deleteMutation.isPending]);

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Booking list</h1>
      </div>

      <div className="panel">
        <ListSearch
          search={list.search}
          onSearchChange={list.setSearch}
          searchPlaceholder="Search doc no, receiver, party…"
          extra={
            <Select
              value={bookingType}
              options={TYPE_FILTER_OPTIONS}
              onChange={(e) => {
                setBookingType(String(e.value ?? ''));
                list.setPage(1);
              }}
              placeholder="All types"
              style={{ minWidth: '10rem' }}
            />
          }
        />
        <ListFilterChrome
          meta={meta}
          sortOptions={SORT_OPTIONS}
          sortKey={list.sortKey}
          onSortChange={list.setSortKey}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          showClearFilters
          onClearFilters={clearAll}
          clearFiltersDisabled={!list.hasActiveFilters && !hasExtraFilters}
        >
          <DataTable
            value={listQuery.data?.data ?? []}
            loading={listQuery.isLoading}
            columns={columns}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header={
          detail
            ? `Booking · ${detail.awb}`
            : viewQuery.isFetching
              ? 'Loading booking…'
              : 'Booking details'
        }
        visible={Boolean(viewId)}
        onHide={() => setViewId(null)}
        style={{ width: 'min(720px, 96vw)' }}
      >
        {viewQuery.isFetching && !detail ? (
          <p className="muted">Loading…</p>
        ) : null}
        {viewQuery.isError ? (
          <p className="error-text">Booking not found</p>
        ) : null}
        {detail ? (
          <div className="form-grid">
            <div className="field">
              <label>Booking Date</label>
              <div>{formatDate(detail.bookingDate)}</div>
            </div>
            <div className="field">
              <label>Document Number</label>
              <div>{detail.awb || '—'}</div>
            </div>
            <div className="field">
              <label>Booking Type</label>
              <div>
                {BOOKING_TYPE_LABELS[detail.bookingType] || detail.bookingType}
              </div>
            </div>
            <div className="field">
              <label>Party</label>
              <div>{detail.customer?.name || detail.partyName || '—'}</div>
            </div>
            <div className="field">
              <label>Courier</label>
              <div>{detail.courierCompany?.name || '—'}</div>
            </div>
            <div className="field">
              <label>Destination</label>
              <div>
                {[detail.receiverCity, detail.receiverState]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </div>
            </div>
            <div className="field">
              <label>Receiver Name</label>
              <div>{detail.receiverName}</div>
            </div>
            <div className="field">
              <label>Receiver Phone</label>
              <div>{detail.receiverPhone || '—'}</div>
            </div>
            <div className="field full">
              <label>Receiver Address</label>
              <div>{detail.receiverAddress || '—'}</div>
            </div>
            <div className="field">
              <label>Service Type</label>
              <div>
                {detail.rateSectionId
                  ? serviceTypeLabel(detail.rateSectionId)
                  : '—'}
              </div>
            </div>
            <div className="field">
              <label>Weight (g)</label>
              <div>{weightGrams(detail.weightKg)}</div>
            </div>
            <div className="field">
              <label>Amount</label>
              <div>₹{money(bookingTotal(detail))}</div>
            </div>
            <div className="field full">
              <label>Remarks</label>
              <div>{detail.remarks || '—'}</div>
            </div>
            <div
              className="field full"
              style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}
            >
              <Button
                label="Edit"
                icon="pi pi-pencil"
                onClick={() => openEdit(detail)}
              />
              <Button
                label="Delete"
                icon="pi pi-trash"
                severity="danger"
                outlined
                disabled={deleteMutation.isPending}
                onClick={() => askDelete(detail)}
              />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        header={editAwb ? `Edit booking · ${editAwb}` : 'Edit booking'}
        visible={Boolean(editId)}
        onHide={closeEdit}
        style={{ width: 'min(960px, 96vw)' }}
        contentStyle={{ maxHeight: 'min(78vh, 820px)' }}
      >
        {editId ? (
          <BookingFormPanel
            key={editId}
            mode={editMode}
            editingId={editId}
            variant="dialog"
            showRemember={false}
            onCancel={closeEdit}
            onEditingChange={(id) => {
              if (!id) closeEdit();
            }}
            onSaved={() => {
              closeEdit();
              void qc.invalidateQueries({ queryKey: ['booking-list'] });
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
