'use client';

import {
  BOOKING_TYPE_LABELS,
  BookingType,
  ChargeType,
  ConsignmentStatus,
} from '@courier/shared';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  Button,
  DataTable,
  Dialog,
  Select,
  Tag,
  type AppColumn,
} from '@/components/ui';
import { ListFilterChrome, ListSearch } from '@/components/ListControls';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import { serviceTypeLabel } from '@/lib/quotations';

interface BookingRow {
  id: string;
  awb: string;
  status: ConsignmentStatus;
  bookingType?: BookingType;
  bookingDate?: string | null;
  receiverName: string;
  receiverPhone?: string | null;
  receiverCity?: string | null;
  createdAt: string;
  customer?: { name?: string } | null;
  partyName?: string | null;
  rateSectionId?: string | null;
  weightKg?: string | number | null;
}

interface ChargeRow {
  type: ChargeType | string;
  amount: string | number;
}

interface ConsignmentDetail {
  id: string;
  awb: string;
  status: ConsignmentStatus;
  bookingType?: BookingType;
  bookingDate?: string | null;
  senderName: string;
  receiverName: string;
  receiverPhone?: string | null;
  receiverAddress: string | null;
  receiverCity?: string | null;
  receiverState?: string | null;
  rateSectionId?: string | null;
  weightKg?: string | number | null;
  cgst?: string | number | null;
  sgst?: string | number | null;
  igst?: string | number | null;
  remarks?: string | null;
  customer?: { name?: string } | null;
  partyName?: string | null;
  charges?: ChargeRow[];
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC', isDefault: true },
  { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { label: 'Date Asc', sortBy: 'bookingDate', sortOrder: 'ASC' },
  { label: 'Date Desc', sortBy: 'bookingDate', sortOrder: 'DESC' },
  { label: 'Document Asc', sortBy: 'awb', sortOrder: 'ASC' },
  { label: 'Document Desc', sortBy: 'awb', sortOrder: 'DESC' },
  { label: 'Receiver Asc', sortBy: 'receiverName', sortOrder: 'ASC' },
  { label: 'Status Asc', sortBy: 'status', sortOrder: 'ASC' },
];

const BOOKING_TYPE_FILTER = [
  { label: 'All types', value: '' },
  { label: BOOKING_TYPE_LABELS[BookingType.ACCOUNT], value: BookingType.ACCOUNT },
  { label: BOOKING_TYPE_LABELS[BookingType.CASH], value: BookingType.CASH },
];

const STATUS_FILTER = [
  { label: 'All statuses', value: '' },
  ...Object.values(ConsignmentStatus).map((s) => ({ label: s, value: s })),
];

function money(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function weightGrams(value: string | number | null | undefined) {
  const kg = Number(value ?? 0);
  if (!Number.isFinite(kg)) return '—';
  return String(Math.round(kg * 1000));
}

function chargeAmount(charges: ChargeRow[] | undefined, type: ChargeType) {
  const row = (charges ?? []).find((c) => c.type === type);
  return row ? money(row.amount) : null;
}

function statusSeverity(
  status: ConsignmentStatus,
): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  switch (status) {
    case ConsignmentStatus.DELIVERED:
      return 'success';
    case ConsignmentStatus.CANCELLED:
    case ConsignmentStatus.RTO:
    case ConsignmentStatus.FAILED_ATTEMPT:
      return 'danger';
    case ConsignmentStatus.OUT_FOR_DELIVERY:
      return 'warn';
    case ConsignmentStatus.BOOKED:
      return 'info';
    default:
      return 'secondary';
  }
}

function BookingListInner() {
  const params = useSearchParams();
  const list = useListParams({ sortOptions: SORT_OPTIONS });
  const [bookingType, setBookingType] = useState('');
  const [status, setStatus] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailAwb, setDetailAwb] = useState('');

  useEffect(() => {
    const awb = params.get('awb')?.trim();
    if (!awb) return;
    setDetailAwb(awb);
    setDetailId(null);
  }, [params]);

  const listQuery = useQuery({
    queryKey: [
      'booking-list',
      list.queryParams,
      bookingType,
      status,
    ],
    queryFn: () =>
      fetchPaginated<BookingRow>('/consignments', {
        ...list.queryParams,
        bookingType: bookingType || undefined,
        status: status || undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['booking-detail', detailId, detailAwb],
    enabled: Boolean(detailId || detailAwb),
    queryFn: async () => {
      if (detailId) {
        const res = await api.get(`/consignments/${detailId}`);
        return unwrap<ConsignmentDetail>(res.data);
      }
      const res = await api.get(`/consignments/awb/${detailAwb}`);
      return unwrap<ConsignmentDetail>(res.data);
    },
  });

  const clearAllFilters = () => {
    list.clearFilters();
    setBookingType('');
    setStatus('');
  };

  const hasFilters =
    list.hasActiveFilters || Boolean(bookingType) || Boolean(status);

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  const columns = useMemo((): AppColumn<BookingRow>[] => {
    return [
      {
        header: 'Document No.',
        body: (row) => row.awb || '—',
      },
      {
        header: 'Type',
        body: (row) =>
          row.bookingType ? BOOKING_TYPE_LABELS[row.bookingType] : '—',
      },
      {
        header: 'Customer / Party',
        body: (row) => row.customer?.name || row.partyName || '—',
      },
      { field: 'receiverName', header: 'Receiver' },
      {
        header: 'Destination',
        body: (row) => row.receiverCity || '—',
      },
      {
        header: 'Service',
        body: (row) =>
          row.rateSectionId ? serviceTypeLabel(row.rateSectionId) : '—',
      },
      {
        header: 'Weight (g)',
        body: (row) => weightGrams(row.weightKg),
      },
      {
        header: 'Date',
        body: (row) =>
          row.bookingDate ||
          new Date(row.createdAt).toLocaleDateString(),
      },
      {
        header: 'Status',
        body: (row) => (
          <Tag severity={statusSeverity(row.status)}>{row.status}</Tag>
        ),
      },
      {
        header: 'Actions',
        body: (row) => (
          <Button
            size="small"
            text
            icon="pi pi-eye"
            label="View"
            onClick={() => {
              setDetailId(row.id);
              setDetailAwb(row.awb);
            }}
          />
        ),
      },
    ];
  }, []);

  const detail = detailQuery.data;
  const freight = chargeAmount(detail?.charges, ChargeType.FREIGHT) ?? '0.00';
  const detailOpen = Boolean(detailId || detailAwb);

  return (
    <div>
      <div className="page-header">
        <h1>Booking list</h1>
      </div>

      <ListSearch
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search document no. / receiver / party…"
        extra={
          <>
            <Select
              value={bookingType}
              options={BOOKING_TYPE_FILTER}
              onChange={(e) => {
                setBookingType(String(e.value || ''));
                list.setPage(1);
              }}
              placeholder="Booking type"
              style={{ minWidth: '10rem' }}
            />
            <Select
              value={status}
              options={STATUS_FILTER}
              onChange={(e) => {
                setStatus(String(e.value || ''));
                list.setPage(1);
              }}
              placeholder="Status"
              style={{ minWidth: '12rem' }}
            />
          </>
        }
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
          onClearFilters={clearAllFilters}
          clearFiltersDisabled={!hasFilters}
        >
          <DataTable
            value={listQuery.data?.data ?? []}
            loading={listQuery.isLoading}
            emptyMessage="No bookings found"
            columns={columns}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header={
          detail
            ? `Booking · ${detail.awb}`
            : detailQuery.isFetching
              ? 'Loading booking…'
              : 'Booking details'
        }
        visible={detailOpen}
        onHide={() => {
          setDetailId(null);
          setDetailAwb('');
        }}
        style={{ width: 'min(720px, 96vw)' }}
      >
        {detailQuery.isFetching && !detail ? (
          <p className="muted">Loading…</p>
        ) : null}
        {detailQuery.isError ? (
          <p className="error-text">Booking not found</p>
        ) : null}
        {detail ? (
          <div className="form-grid">
            <div className="field">
              <label>Booking Date</label>
              <div>{detail.bookingDate || '—'}</div>
            </div>
            <div className="field">
              <label>Document Number</label>
              <div>{detail.awb || '—'}</div>
            </div>
            <div className="field">
              <label>Booking Type</label>
              <div>
                {detail.bookingType
                  ? BOOKING_TYPE_LABELS[detail.bookingType]
                  : '—'}
              </div>
            </div>
            <div className="field">
              <label>Status</label>
              <div>
                <Tag severity={statusSeverity(detail.status)}>
                  {detail.status}
                </Tag>
              </div>
            </div>
            <div className="field">
              <label>Customer / Party</label>
              <div>{detail.customer?.name || detail.partyName || '—'}</div>
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
              <label>Price</label>
              <div>{freight}</div>
            </div>
            <div className="field">
              <label>CGST</label>
              <div>
                {chargeAmount(detail.charges, ChargeType.CGST) ??
                  money(detail.cgst)}
              </div>
            </div>
            <div className="field">
              <label>SGST</label>
              <div>
                {chargeAmount(detail.charges, ChargeType.SGST) ??
                  money(detail.sgst)}
              </div>
            </div>
            <div className="field">
              <label>IGST</label>
              <div>
                {chargeAmount(detail.charges, ChargeType.IGST) ??
                  money(detail.igst)}
              </div>
            </div>
            <div className="field full">
              <label>Remarks</label>
              <div>{detail.remarks || '—'}</div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

export default function BookingListPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <BookingListInner />
    </Suspense>
  );
}
