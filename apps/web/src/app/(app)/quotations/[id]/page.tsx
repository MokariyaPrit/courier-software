'use client';

import { QuotationStatus } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, InputText, Tag } from '@/components/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RateMatrixEditor } from '@/components/RateMatrixEditor';
import { api, unwrap } from '@/lib/api';
import {
  matrixPayload,
  RateMatrixForm,
  toMatrixForm,
} from '@/lib/quotations';

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  // Accept ISO / date-only from API
  return value.slice(0, 10);
}

interface QuotationDetail {
  id: string;
  quotationCode: string | null;
  quotationDate: string;
  status: QuotationStatus;
  notes: string | null;
  customer?: {
    name: string;
    fuelChargesExtraPercent?: string | number;
    fovPercent?: string | number;
  } | null;
  template?: { name: string } | null;
  snapshot?: {
    fuelChargesExtraPercent: string;
    fovPercent: string;
    columns?: RateMatrixForm['columns'];
    sections?: RateMatrixForm['sections'];
    rows?: Array<{
      id?: string;
      sectionId?: string;
      serviceType?: string;
      weightLabel: string;
      weightGrams?: number | null;
      isAdditional?: boolean;
      sortOrder?: number;
      rates?: Record<string, string | number>;
    }>;
  } | null;
}

const EMPTY_MATRIX: RateMatrixForm = { columns: [], sections: [], rows: [] };

export default function QuotationDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();
  const [matrix, setMatrix] = useState<RateMatrixForm>(EMPTY_MATRIX);
  const [quotationDate, setQuotationDate] = useState('');
  const [error, setError] = useState('');
  const [savedHint, setSavedHint] = useState('');

  const detailQuery = useQuery({
    queryKey: ['quotation', id],
    queryFn: async () => {
      const res = await api.get(`/quotations/${id}`);
      return unwrap<QuotationDetail>(res.data);
    },
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    setQuotationDate(toDateInputValue(detailQuery.data.quotationDate));
    if (detailQuery.data.snapshot) {
      setMatrix(
        toMatrixForm({
          columns: detailQuery.data.snapshot.columns,
          sections: detailQuery.data.snapshot.sections,
          rows: detailQuery.data.snapshot.rows,
        }),
      );
    }
  }, [detailQuery.data]);

  const savePayload = () => ({
    ...matrixPayload(matrix),
    quotationDate: quotationDate || undefined,
  });

  const apiErrorMessage = (err: unknown, fallback: string) => {
    const data = (
      err as {
        response?: {
          data?: {
            error?: { message?: string | string[] };
            message?: string | string[];
          };
        };
        message?: string;
      }
    )?.response?.data;
    const raw =
      data?.error?.message ??
      data?.message ??
      (err as { message?: string })?.message;
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'string' && raw.trim()) return raw;
    return fallback;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setError('');
      await api.patch(`/quotations/${id}`, savePayload());
    },
    onSuccess: async () => {
      setError('');
      setSavedHint('Saved');
      await qc.invalidateQueries({ queryKey: ['quotation', id] });
    },
    onError: (err: unknown) => {
      setSavedHint('');
      setError(apiErrorMessage(err, 'Failed to save'));
    },
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      setError('');
      setSavedHint('');
      await api.patch(`/quotations/${id}`, savePayload());
      const res = await api.post(`/quotations/${id}/issue`, {});
      return unwrap<QuotationDetail>(res.data);
    },
    onSuccess: async () => {
      setError('');
      setSavedHint('Quotation issued');
      await qc.invalidateQueries({ queryKey: ['quotation', id] });
      await qc.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: (err: unknown) => {
      setSavedHint('');
      setError(apiErrorMessage(err, 'Failed to issue quotation'));
    },
  });

  const q = detailQuery.data;
  const isIssued = q?.status === QuotationStatus.ISSUED;

  if (detailQuery.isLoading) {
    return <div className="page-center">Loading quotation…</div>;
  }

  if (!q) {
    return (
      <div>
        <p className="error-text">Quotation not found</p>
        <Link href="/quotations">Back to list</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            Quotation {q.quotationCode ? `#${q.quotationCode}` : '(draft)'}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {q.customer?.name} ·{' '}
            <Tag severity={isIssued ? 'success' : 'info'}>{q.status}</Tag>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/quotations">
            <Button label="Back" severity="secondary" text />
          </Link>
          <Link href={`/quotations/${id}/print`} target="_blank">
            <Button label="Preview / Print" icon="pi pi-print" outlined />
          </Link>
          <Button
            label="Save"
            icon="pi pi-save"
            severity="secondary"
            loading={saveMutation.isPending}
            onClick={() => {
              setSavedHint('');
              saveMutation.mutate();
            }}
          />
          <Button
            label={isIssued ? 'Re-issue' : 'Issue quotation'}
            icon="pi pi-check"
            loading={issueMutation.isPending}
            onClick={() => {
              setError('');
              setSavedHint('');
              issueMutation.mutate();
            }}
          />
        </div>
      </div>

      {error ? (
        <div
          className="panel"
          style={{
            marginBottom: '1rem',
            borderColor: '#c45c5c',
            background: '#fdf2f2',
          }}
          role="alert"
        >
          <p className="error-text" style={{ margin: 0 }}>
            {error}
          </p>
        </div>
      ) : null}
      {savedHint ? (
        <p className="muted" style={{ marginTop: 0 }}>
          {savedHint}
        </p>
      ) : null}

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
          <div className="field">
            <label htmlFor="quotation-date">Quotation date</label>
            <InputText
              id="quotation-date"
              type="date"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
              style={{ width: '100%', maxWidth: '16rem' }}
            />
          </div>
        </div>
        <p style={{ margin: 0 }}>
          Template: <strong>{q.template?.name || '—'}</strong>
          {' · '}
          FOV:{' '}
          <strong>
            {q.snapshot?.fovPercent ?? q.customer?.fovPercent ?? 0}%
          </strong>
          {' · '}
          Fuel extra:{' '}
          <strong>
            {q.snapshot?.fuelChargesExtraPercent ??
              q.customer?.fuelChargesExtraPercent ??
              0}
            %
          </strong>
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Date and rates stay editable. Save anytime; Issue / Re-issue refreshes
          FOV/fuel from the customer and keeps the quotation code.
        </p>
      </div>

      <RateMatrixEditor value={matrix} onChange={setMatrix} />
    </div>
  );
}
