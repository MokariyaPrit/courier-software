'use client';

import { CONSIGNMENT_STATUS_FLOW, ConsignmentStatus } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '@/lib/api';

interface TrackingEvent {
  id: string;
  status: string;
  remarks: string | null;
  createdAt: string;
  branch?: { name: string } | null;
  createdBy?: { fullName: string };
}

interface ConsignmentDetail {
  id: string;
  awb: string;
  status: ConsignmentStatus;
  senderName: string;
  receiverName: string;
  receiverAddress: string | null;
  trackingEvents?: TrackingEvent[];
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

      {detailQuery.data ? (
        <div className="panel" style={{ display: 'grid', gap: '1.25rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem' }}>{detailQuery.data.awb}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {detailQuery.data.senderName} → {detailQuery.data.receiverName} ·{' '}
              {detailQuery.data.status}
            </p>
          </div>

          <div>
            <h3>Update status</h3>
            {allowed.length === 0 ? (
              <p className="muted">Terminal status — no further transitions.</p>
            ) : (
              <div className="toolbar">
                <Dropdown
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
              {(detailQuery.data.trackingEvents ?? []).map((ev) => (
                <li key={ev.id}>
                  <strong>{ev.status}</strong>
                  <div className="muted">
                    {new Date(ev.createdAt).toLocaleString()}
                    {ev.branch ? ` · ${ev.branch.name}` : ''}
                    {ev.createdBy ? ` · ${ev.createdBy.fullName}` : ''}
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
