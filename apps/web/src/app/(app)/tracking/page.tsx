'use client';

import {
  BOOKING_TYPE_LABELS,
  BookingType,
  ConsignmentStatus,
} from '@courier/shared';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  Button,
  DataTable,
  Dialog,
  InputText,
  SearchSelect,
  Select,
  Tag,
  type AppColumn,
  type SearchSelectOption,
} from '@/components/ui';
import { BookingFormPanel } from '@/components/bookings/BookingFormPanel';
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
  price?: string | number | null;
  cgst?: string | number | null;
  sgst?: string | number | null;
  igst?: string | number | null;
  remarks?: string | null;
  customer?: { name?: string } | null;
  partyName?: string | null;
}

type DialogMode = 'view' | 'edit';

interface CustomerOpt {
  id: string;
  name: string;
  city?: string | null;
  primaryPhone?: string | null;
}

type ViewMode = 'all' | 'customer' | 'party';

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
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [bookingType, setBookingType] = useState('');
  const [status, setStatus] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerLabel, setCustomerLabel] = useState('');
  const [partyLabel, setPartyLabel] = useState('');
  const [partyName, setPartyName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailAwb, setDetailAwb] = useState('');
  const goAllBookings = () => {
    setViewMode('all');
    setCustomerId('');
    setCustomerLabel('');
    setPartyLabel('');
    setPartyName('');
    list.setPage(1);
  };

  useEffect(() => {
    const awb = params.get('awb')?.trim();
    if (!awb) return;
    setDetailAwb(awb);
    setDetailId(null);
    setDialogMode('view');
  }, [params]);

  const closeDialog = () => {
    setDialogMode(null);
    setDetailId(null);
    setDetailAwb('');
  };

  const openView = (row: BookingRow) => {
    setDialogMode('view');
    setDetailId(row.id);
    setDetailAwb(row.awb);
  };

  const openEdit = (row: BookingRow) => {
    setDialogMode('edit');
    setDetailId(row.id);
    setDetailAwb(row.awb);
  };

  const customersQuery = useQuery({
    queryKey: ['customers-booking-list'],
    queryFn: () =>
      fetchPaginated<CustomerOpt>('/customers', {
        page: 1,
        pageSize: 500,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
    enabled: viewMode === 'customer',
  });

  const partyOptionsQuery = useQuery({
    queryKey: ['party-options-booking-list'],
    queryFn: () =>
      fetchPaginated<BookingRow>('/consignments', {
        page: 1,
        pageSize: 200,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        bookingType: BookingType.CASH,
      }),
    enabled: viewMode === 'party',
  });

  const customerOptions: SearchSelectOption[] = useMemo(
    () => [
      { value: '', label: 'All customers' },
      ...(customersQuery.data?.data ?? []).map((c) => ({
        value: c.id,
        label: c.name,
        subLabel: c.city || c.primaryPhone || undefined,
      })),
    ],
    [customersQuery.data],
  );

  const partyOptions: SearchSelectOption[] = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of partyOptionsQuery.data?.data ?? []) {
      const name = row.partyName?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!names.has(key)) names.set(key, name);
    }
    return [
      { value: '', label: 'All parties' },
      ...Array.from(names.values())
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name })),
    ];
  }, [partyOptionsQuery.data]);

  const listQuery = useQuery({
    queryKey: [
      'booking-list',
      list.queryParams,
      viewMode,
      bookingType,
      status,
      customerId,
      partyName,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      fetchPaginated<BookingRow>('/consignments', {
        ...list.queryParams,
        bookingType:
          viewMode === 'customer'
            ? BookingType.ACCOUNT
            : viewMode === 'party'
              ? BookingType.CASH
              : bookingType || undefined,
        status: status || undefined,
        customerId:
          viewMode === 'customer' && customerId ? customerId : undefined,
        partyName: viewMode === 'party' && partyName ? partyName : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['booking-detail', detailId, detailAwb],
    enabled: Boolean(dialogMode && (detailId || detailAwb)),
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
    setDateFrom('');
    setDateTo('');
    goAllBookings();
  };

  const hasFilters =
    list.hasActiveFilters ||
    Boolean(bookingType) ||
    Boolean(status) ||
    viewMode !== 'all' ||
    Boolean(customerId) ||
    Boolean(partyName) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

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
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <Button
              size="small"
              text
              icon="pi pi-eye"
              label="View"
              onClick={() => openView(row)}
            />
            <Button
              size="small"
              text
              icon="pi pi-pencil"
              label="Edit"
              onClick={() => openEdit(row)}
            />
          </div>
        ),
      },
    ];
  }, []);

  const detail = detailQuery.data;
  const freight = money(detail?.price);
  const detailOpen = Boolean(dialogMode && (detailId || detailAwb));

  const emptyMessage = 'No bookings found';

  return (
    <div>
      <div className="page-header">
        <h1>Booking list</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            label="All bookings"
            outlined={viewMode !== 'all'}
            onClick={goAllBookings}
          />
          <Button
            label="Customer wise"
            outlined={viewMode !== 'customer'}
            onClick={() => {
              setViewMode('customer');
              setPartyLabel('');
              setPartyName('');
              setCustomerId('');
              setCustomerLabel('');
              setBookingType('');
              list.setPage(1);
            }}
          />
          <Button
            label="Party wise"
            outlined={viewMode !== 'party'}
            onClick={() => {
              setViewMode('party');
              setCustomerId('');
              setCustomerLabel('');
              setPartyName('');
              setPartyLabel('');
              setBookingType('');
              list.setPage(1);
            }}
          />
        </div>
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Customer wise loads all account bookings by default (pick a customer to
        filter). Party wise loads all cash bookings by default (pick a party to
        filter).
      </p>

      <ListSearch
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search document no. / receiver / party / customer…"
        extra={
          <>
            {viewMode === 'customer' ? (
              <div style={{ minWidth: '16rem', flex: '1 1 16rem' }}>
                <SearchSelect
                  value={customerLabel}
                  options={customerOptions}
                  placeholder="All customers — type to filter…"
                  allowFreeText={false}
                  emptyHint="No customers match"
                  onChange={(text) => {
                    setCustomerLabel(text);
                    setCustomerId('');
                  }}
                  onSelect={(opt) => {
                    if (!opt || !opt.value) {
                      setCustomerId('');
                      setCustomerLabel('');
                      list.setPage(1);
                      return;
                    }
                    setCustomerId(opt.value);
                    setCustomerLabel(opt.label);
                    list.setPage(1);
                  }}
                />
              </div>
            ) : null}
            {viewMode === 'party' ? (
              <div style={{ minWidth: '16rem', flex: '1 1 16rem' }}>
                <SearchSelect
                  value={partyLabel}
                  options={partyOptions}
                  placeholder="All parties — type to filter…"
                  allowFreeText
                  emptyHint="No parties yet — type a name"
                  onChange={(text) => {
                    setPartyLabel(text);
                    setPartyName('');
                  }}
                  onSelect={(opt) => {
                    if (!opt || !opt.value) {
                      const typed = partyLabel.trim();
                      if (
                        typed &&
                        typed.toLowerCase() !== 'all parties'
                      ) {
                        setPartyName(typed);
                        setPartyLabel(typed);
                      } else {
                        setPartyName('');
                        setPartyLabel('');
                      }
                      list.setPage(1);
                      return;
                    }
                    setPartyName(opt.value);
                    setPartyLabel(opt.label);
                    list.setPage(1);
                  }}
                />
              </div>
            ) : null}
            {viewMode === 'all' ? (
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
            ) : null}
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
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                From
              </span>
              <InputText
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  list.setPage(1);
                }}
                style={{ width: '10.5rem' }}
              />
            </label>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                To
              </span>
              <InputText
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  list.setPage(1);
                }}
                style={{ width: '10.5rem' }}
              />
            </label>
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
            loading={listQuery.isFetching}
            emptyMessage={emptyMessage}
            columns={columns}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header={
          detail
            ? `${dialogMode === 'edit' ? 'Edit booking' : 'Booking'} · ${detail.awb}`
            : detailQuery.isFetching
              ? 'Loading booking…'
              : dialogMode === 'edit'
                ? 'Edit booking'
                : 'Booking details'
        }
        visible={detailOpen}
        onHide={closeDialog}
        style={{ width: 'min(920px, 96vw)' }}
      >
        {detailQuery.isFetching && !detail ? (
          <p className="muted">Loading…</p>
        ) : null}
        {detailQuery.isError ? (
          <p className="error-text">Booking not found</p>
        ) : null}
        {detail && dialogMode === 'view' ? (
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
                {money(detail.cgst)}
              </div>
            </div>
            <div className="field">
              <label>SGST</label>
              <div>
                {money(detail.sgst)}
              </div>
            </div>
            <div className="field">
              <label>IGST</label>
              <div>
                {money(detail.igst)}
              </div>
            </div>
            <div className="field full">
              <label>Remarks</label>
              <div>{detail.remarks || '—'}</div>
            </div>
          </div>
        ) : null}
        {detail && dialogMode === 'edit' ? (
          <BookingFormPanel
            mode={
              detail.bookingType === BookingType.CASH
                ? BookingType.CASH
                : BookingType.ACCOUNT
            }
            editingId={detail.id}
            variant="dialog"
            showRemember={false}
            onCancel={closeDialog}
            onSaved={() => closeDialog()}
          />
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
