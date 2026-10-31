'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, InputText } from '@/components/ui';
import { useEffect, useState } from 'react';
import { RateMatrixEditor } from '@/components/RateMatrixEditor';
import { api, unwrap } from '@/lib/api';
import {
  matrixPayload,
  RateMatrixForm,
  toMatrixForm,
} from '@/lib/quotations';

interface CashTemplate {
  id: string;
  name: string;
  columns?: RateMatrixForm['columns'];
  sections?: RateMatrixForm['sections'];
  rows?: RateMatrixForm['rows'];
}

const EMPTY: RateMatrixForm = { columns: [], sections: [], rows: [] };

export default function CashRatesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('Cash booking rates');
  const [matrix, setMatrix] = useState<RateMatrixForm>(EMPTY);
  const [error, setError] = useState('');
  const [savedHint, setSavedHint] = useState('');

  const templateQuery = useQuery({
    queryKey: ['cash-rates-mine'],
    queryFn: async () => {
      const res = await api.get('/quotation-templates/cash/mine');
      return unwrap<CashTemplate>(res.data);
    },
  });

  useEffect(() => {
    if (!templateQuery.data) return;
    setName(templateQuery.data.name || 'Cash booking rates');
    setMatrix(
      toMatrixForm({
        columns: templateQuery.data.columns,
        sections: templateQuery.data.sections,
        rows: templateQuery.data.rows,
      }),
    );
  }, [templateQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!templateQuery.data?.id) return;
      await api.patch(`/quotation-templates/${templateQuery.data.id}`, {
        name: name.trim(),
        ...matrixPayload(matrix),
      });
    },
    onSuccess: async () => {
      setError('');
      setSavedHint('Cash rates saved');
      await qc.invalidateQueries({ queryKey: ['cash-rates-mine'] });
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to save',
      );
    },
  });

  if (templateQuery.isLoading) {
    return <div className="page-center">Loading cash rates…</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Cash rates</h1>
          <p className="muted" style={{ margin: 0 }}>
            Personal cash booking rates. Columns sync from Rate columns
            (selected cities + ROI).
          </p>
        </div>
        <Button
          label="Save rates"
          icon="pi pi-save"
          loading={saveMutation.isPending}
          onClick={() => {
            setSavedHint('');
            saveMutation.mutate();
          }}
        />
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="field" style={{ maxWidth: '28rem' }}>
          <label>Template name</label>
          <InputText
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <RateMatrixEditor value={matrix} onChange={setMatrix} />
      {error ? <p className="error-text">{error}</p> : null}
      {savedHint ? <p className="muted">{savedHint}</p> : null}
    </div>
  );
}
