'use client';

import {
  BOOKING_TYPE_LABELS,
  BookingType,
  ConsignmentStatus,
} from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ConfirmDialog,
  confirmDialog,
  Dialog,
  Tag,
} from '@/components/ui';
import { BookingFormPanel } from '@/components/bookings/BookingFormPanel';
import { useEffect, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { fetchPaginated } from '@/lib/list';
import { serviceTypeLabel } from '@/lib/quotations';

interface ConsignmentRow {
  id: string;
  awb: string;
  status: string;
  bookingType?: BookingType;
  receiverName: string;
  receiverCity?: string | null;
  bookingDate?: string | null;
  createdAt: string;
  customer?: { name: string } | null;
  partyName?: string | null;
  weightKg?: string | number | null;
  rateSectionId?: string | null;
  price?: string | number | null;
}

interface ConsignmentDetail {
  id: string;
  awb: string;
  status: ConsignmentStatus;
  bookingType?: BookingType;
  bookingDate?: string | null;
  receiverName: string;
  receiverPhone?: string | null;
  receiverAddress?: string | null;
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
  status: string,
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

function modePath(mode: BookingType) {
  return mode === BookingType.CASH ? '/bookings/cash' : '/bookings/account';
}

export function BookingsPageView({ mode }: { mode: BookingType }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    const editId = searchParams.get('edit')?.trim();
    if (!editId) return;
    setEditingId(editId);
    router.replace(modePath(mode));
  }, [searchParams, mode, router]);

  const recentQuery = useQuery({
    queryKey: ['consignments-recent', mode],
    queryFn: () =>
      fetchPaginated<ConsignmentRow>('/consignments', {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        mine: true,
        bookingType: mode,
      }),
  });

  const viewQuery = useQuery({
    queryKey: ['booking-detail', viewId],
    enabled: Boolean(viewId),
    queryFn: async () => {
      const res = await api.get(`/consignments/${viewId}`);
      return unwrap<ConsignmentDetail>(res.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/consignments/${id}`);
    },
    onSuccess: async (_data, id) => {
      if (editingId === id) setEditingId(null);
      if (viewId === id) setViewId(null);
      await qc.invalidateQueries({ queryKey: ['consignments-recent'] });
      await qc.invalidateQueries({ queryKey: ['consignments'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
      await qc.invalidateQueries({ queryKey: ['booking-list'] });
    },
  });

  const askDelete = (row: ConsignmentRow) => {
    confirmDialog({
      header: 'Delete booking',
      message: `Delete booking ${row.awb}? Bookings already on an invoice cannot be deleted.`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row.id),
    });
  };

  const detail = viewQuery.data;
  const freight = money(detail?.price);
  const title =
    mode === BookingType.ACCOUNT ? 'Account booking' : 'Cash booking';

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>{title}</h1>
      </div>

      <div className="bookings-split">
        <BookingFormPanel
          mode={mode}
          editingId={editingId}
          variant="page"
          showRemember
          onEditingChange={setEditingId}
          onCancel={() => setEditingId(null)}
        />

        <aside className="bookings-split-recent panel">
          <h2>Recent {BOOKING_TYPE_LABELS[mode].toLowerCase()}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Last {recentQuery.data?.data?.length ?? 0} of yours
          </p>
          <div className="booking-recent-list">
            {(recentQuery.data?.data ?? []).map((row) => {
              const accountOrParty =
                row.customer?.name || row.partyName || null;
              const metaParts = [
                row.bookingDate ||
                  new Date(row.createdAt).toLocaleDateString(),
                row.receiverCity || null,
                row.rateSectionId
                  ? serviceTypeLabel(row.rateSectionId)
                  : null,
                row.weightKg != null
                  ? `${weightGrams(row.weightKg)} g`
                  : null,
              ].filter(Boolean);

              return (
                <div key={row.id} className="booking-recent-card">
                  <div className="booking-recent-main">
                    <div className="booking-recent-line">
                      <button
                        type="button"
                        className="booking-recent-awb"
                        onClick={() => setViewId(row.id)}
                      >
                        {row.awb}
                      </button>
                      <span className="booking-recent-rate">
                        ₹{money(row.price)}
                      </span>
                    </div>
                    <div className="booking-recent-receiver">
                      {row.receiverName}
                      {accountOrParty ? (
                        <span className="muted"> · {accountOrParty}</span>
                      ) : null}
                    </div>
                    {metaParts.length ? (
                      <div className="booking-recent-meta">
                        {metaParts.join(' · ')}
                      </div>
                    ) : null}
                  </div>
                  <div className="booking-recent-actions">
                    <button
                      type="button"
                      className="booking-recent-icon-btn"
                      title="View"
                      aria-label="View"
                      onClick={() => setViewId(row.id)}
                    >
                      <i className="pi pi-eye" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="booking-recent-icon-btn"
                      title="Edit"
                      aria-label="Edit"
                      onClick={() => setEditingId(row.id)}
                    >
                      <i className="pi pi-pencil" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="booking-recent-icon-btn danger"
                      title="Delete"
                      aria-label="Delete"
                      disabled={deleteMutation.isPending}
                      onClick={() => askDelete(row)}
                    >
                      <i className="pi pi-trash" aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
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
              <label>Party</label>
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
              <div>{money(detail.cgst)}</div>
            </div>
            <div className="field">
              <label>SGST</label>
              <div>{money(detail.sgst)}</div>
            </div>
            <div className="field">
              <label>IGST</label>
              <div>{money(detail.igst)}</div>
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
