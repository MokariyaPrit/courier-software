'use client';

import {
  BOOKING_TYPE_LABELS,
  BookingType,
  ChargeType,
  CONSIGNMENT_STATUS_FLOW,
  ConsignmentStatus,
} from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Button, InputText, Select } from '@/components/ui';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { serviceTypeLabel } from '@/lib/quotations';

interface TrackingEvent {
  id: string;
  status: string;
  remarks: string | null;
  locationLabel: string | null;
  createdAt: string;
  createdBy?: { userInfo?: { fullName?: string } | null };
}

interface ChargeRow {
  type: ChargeType | string;
  amount: string | number;
  description?: string | null;
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
  trackingEvents?: TrackingEvent[];
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

function chargeAmount(charges: ChargeRow[] | undefined, type: ChargeType) {
  const row = (charges ?? []).find((c) => c.type === type);
  return row ? money(row.amount) : null;
}

function TrackingInner() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const [awb, setAwb] = useState(params.get('awb') || '');
  const [queryAwb, setQueryAwb] = useState(params.get('awb') || '');
  const [nextStatus, setNextStatus] = useState<ConsignmentStatus | null>(null);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    const initial = params.get('awb');
    if (initial) {
      setAwb(initial);
      setQueryAwb(initial);
    }
  }, [params]);

  const detailQuery = useQuery({
    queryKey: ['tracking', queryAwb],
    enabled: Boolean(queryAwb),
    queryFn: async () => {
      const res = await api.get(`/consignments/awb/${queryAwb}`);
      return unwrap<ConsignmentDetail>(res.data);
    },
  });

  const allowed = useMemo(() => {
    if (!detailQuery.data) return [];
    return CONSIGNMENT_STATUS_FLOW[detailQuery.data.status] ?? [];
  }, [detailQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!detailQuery.data || !nextStatus) return;
      await api.patch(`/consignments/${detailQuery.data.id}/status`, {
        status: nextStatus,
        remarks: remarks || undefined,
      });
    },
    onSuccess: async () => {
      setRemarks('');
      setNextStatus(null);
      await qc.invalidateQueries({ queryKey: ['tracking', queryAwb] });
      await qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
      await qc.invalidateQueries({ queryKey: ['ofd'] });
    },
  });

  const detail = detailQuery.data;
  const freight = chargeAmount(detail?.charges, ChargeType.FREIGHT) ?? '0.00';

  return (
    <div>
      <div className="page-header">
        <h1>Tracking</h1>
      </div>
      <div className="toolbar">
        <InputText
          placeholder="Enter AWB"
          value={awb}
          onChange={(e) => setAwb(e.target.value)}
        />
        <Button label="Search" onClick={() => setQueryAwb(awb.trim())} />
      </div>

      {detailQuery.isFetching ? <p className="muted">Loading…</p> : null}
      {detailQuery.isError ? (
        <p className="error-text">Consignment not found</p>
      ) : null}

      {detail ? (
        <div className="panel" style={{ display: 'grid', gap: '1.25rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem' }}>{detail.awb}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {detail.senderName} → {detail.receiverName} · {detail.status}
            </p>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Booking Date</label>
              <div>{detail.bookingDate || '—'}</div>
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
              <label>Customer / Party</label>
              <div>
                {detail.customer?.name || detail.partyName || '—'}
              </div>
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

          <div>
            <h3>Update status</h3>
            {allowed.length === 0 ? (
              <p className="muted">Terminal status — no further transitions.</p>
            ) : (
              <div className="toolbar">
                <Select
                  value={nextStatus}
                  options={allowed.map((s) => ({ label: s, value: s }))}
                  onChange={(e) => setNextStatus(e.value)}
                  placeholder="Next status"
                  style={{ minWidth: 220 }}
                />
                <InputText
                  placeholder="Remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <Button
                  label="Update"
                  disabled={!nextStatus}
                  loading={updateMutation.isPending}
                  onClick={() => updateMutation.mutate()}
                />
              </div>
            )}
          </div>

          <div>
            <h3>Timeline</h3>
            <ul className="timeline">
              {(detail.trackingEvents ?? []).map((ev) => (
                <li key={ev.id}>
                  <strong>{ev.status}</strong>
                  <div className="muted">
                    {new Date(ev.createdAt).toLocaleString()}
                    {ev.locationLabel ? ` · ${ev.locationLabel}` : ''}
                    {ev.createdBy?.userInfo?.fullName
                      ? ` · ${ev.createdBy.userInfo.fullName}`
                      : ''}
                  </div>
                  {ev.remarks ? <div>{ev.remarks}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <TrackingInner />
    </Suspense>
  );
}
