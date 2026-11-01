'use client';

import { BOOKING_TYPE_LABELS, BookingType } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  ConfirmDialog,
  confirmDialog,
} from '@/components/ui';
import { BookingFormPanel } from '@/components/bookings/BookingFormPanel';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fetchPaginated } from '@/lib/list';

interface ConsignmentRow {
  id: string;
  awb: string;
  status: string;
  bookingType?: BookingType;
  receiverName: string;
  bookingDate?: string | null;
  createdAt: string;
  customer?: { name: string } | null;
  partyName?: string | null;
}

function BookingsPageInner() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const mode: BookingType =
    typeParam === BookingType.CASH ? BookingType.CASH : BookingType.ACCOUNT;

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const editId = searchParams.get('edit')?.trim();
    if (!editId) return;
    setEditingId(editId);
    router.replace(`/bookings?type=${mode}`);
  }, [searchParams, mode, router]);

  const setMode = (next: BookingType) => {
    setEditingId(null);
    router.replace(`/bookings?type=${next}`);
  };

  const recentQuery = useQuery({
    queryKey: ['consignments-recent', mode],
    queryFn: () =>
      fetchPaginated<ConsignmentRow>('/consignments', {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        mine: true,
        bookingType: mode,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/consignments/${id}`);
    },
    onSuccess: async (_data, id) => {
      if (editingId === id) setEditingId(null);
      await qc.invalidateQueries({ queryKey: ['consignments-recent'] });
      await qc.invalidateQueries({ queryKey: ['consignments'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
      await qc.invalidateQueries({ queryKey: ['booking-list'] });
    },
  });

  const askDelete = (row: ConsignmentRow) => {
    confirmDialog({
      header: 'Delete booking',
      message: `Delete booking ${row.awb}? It will be hidden from lists (soft delete).`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row.id),
    });
  };

  return (
    <div>
      <ConfirmDialog />
      <div className="page-header">
        <h1>Bookings</h1>
        <div className="booking-mode-tabs">
          <Button
            label="Account Booking"
            outlined={mode !== BookingType.ACCOUNT}
            onClick={() => setMode(BookingType.ACCOUNT)}
          />
          <Button
            label="Cash Booking"
            outlined={mode !== BookingType.CASH}
            onClick={() => setMode(BookingType.CASH)}
          />
        </div>
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
            {(recentQuery.data?.data ?? []).map((row) => (
              <div key={row.id} className="booking-recent-card">
                <div className="booking-recent-awb">
                  <Link href={`/tracking?awb=${encodeURIComponent(row.awb)}`}>
                    {row.awb}
                  </Link>
                </div>
                <div className="booking-recent-meta">
                  <span>
                    {row.bookingType
                      ? BOOKING_TYPE_LABELS[row.bookingType]
                      : '—'}
                  </span>
                  <span>{row.status}</span>
                </div>
                <div className="booking-recent-receiver">
                  {row.receiverName}
                  {row.customer?.name
                    ? ` · ${row.customer.name}`
                    : row.partyName
                      ? ` · ${row.partyName}`
                      : ''}
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {row.bookingDate ||
                    new Date(row.createdAt).toLocaleDateString()}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.35rem',
                    marginTop: '0.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    size="small"
                    text
                    icon="pi pi-pencil"
                    label="Edit"
                    onClick={() => setEditingId(row.id)}
                  />
                  <Button
                    size="small"
                    text
                    severity="danger"
                    icon="pi pi-trash"
                    label="Delete"
                    loading={deleteMutation.isPending}
                    onClick={() => askDelete(row)}
                  />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <BookingsPageInner />
    </Suspense>
  );
}
