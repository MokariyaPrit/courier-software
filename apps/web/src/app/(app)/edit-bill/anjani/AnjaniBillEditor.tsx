'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { api, unwrap } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dataUrlToBlob, type AnjaniBillRecord } from '@/lib/anjani-bill';
import { mediaUrl } from '@/lib/media-url';
import { uploadFile } from '@/lib/r2-upload';
import { apiErrorMessage } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type EditorSave = {
  type: 'anjani-save';
  requestId: string;
  bill?: Record<string, string | null> & { rows?: unknown[] };
  headerDataUrl?: string;
  pdfName?: string;
  pdfBuffer?: ArrayBuffer;
  editedPdfName?: string;
  editedPdfBuffer?: ArrayBuffer;
  error?: string;
};

export function AnjaniBillEditor({ billId }: { billId?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const isNew = !billId || billId === 'new';
  const [error, setError] = useState('');
  const [frameReady, setFrameReady] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['anjani-bill', billId],
    enabled: !isNew && Boolean(billId),
    queryFn: async () => {
      const res = await api.get(`/anjani-bills/${billId}`);
      return unwrap<AnjaniBillRecord>(res.data);
    },
  });

  const info = user?.userInfo;
  const header =
    detailQuery.data?.headerImageUrl || mediaUrl(info?.logoUrl) || '';

  useEffect(() => {
    if (!frameReady) return;
    const frame = frameRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(
      {
        type: 'anjani-load',
        companyName: info?.companyName || 'Shree Anjani Courier',
        header,
        bank: {
          bankName: detailQuery.data?.bankName || info?.bankName || '',
          accountNo: detailQuery.data?.accountNo || info?.bankAccountNo || '',
          ifsc: detailQuery.data?.ifsc || info?.bankIfsc || '',
        },
        bill: detailQuery.data
          ? {
              customerName: detailQuery.data.customerName,
              address1: detailQuery.data.address1,
              address2: detailQuery.data.address2,
              customerGst: detailQuery.data.customerGst,
              customerCode: detailQuery.data.customerCode,
              customerPan: detailQuery.data.customerPan,
              billNo: detailQuery.data.billNo,
              billDate: detailQuery.data.billDate,
              billPeriod: detailQuery.data.billPeriod,
              hsn: detailQuery.data.hsn,
              fuel: detailQuery.data.fuel,
              bankName: detailQuery.data.bankName,
              accountNo: detailQuery.data.accountNo,
              ifsc: detailQuery.data.ifsc,
              gross: detailQuery.data.gross,
              sub: detailQuery.data.sub,
              sgst: detailQuery.data.sgst,
              cgst: detailQuery.data.cgst,
              igst: detailQuery.data.igst,
              bill: detailQuery.data.bill,
              words: detailQuery.data.words,
              rows: detailQuery.data.rows || [],
            }
          : null,
      },
      window.location.origin,
    );
  }, [frameReady, header, info, detailQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const frame = frameRef.current?.contentWindow;
      if (!frame) throw new Error('Editor is not ready');
      const requestId = String(Date.now());
      const saved = await new Promise<EditorSave>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          window.removeEventListener('message', onMessage);
          reject(new Error('Editor did not respond'));
        }, 120000);
        function onMessage(event: MessageEvent) {
          const data = event.data as EditorSave;
          if (event.origin !== window.location.origin) return;
          if (!data || data.type !== 'anjani-save' || data.requestId !== requestId) return;
          window.clearTimeout(timer);
          window.removeEventListener('message', onMessage);
          resolve(data);
        }
        window.addEventListener('message', onMessage);
        frame.postMessage(
          { type: 'anjani-save-request', requestId },
          window.location.origin,
        );
      });

      if (saved.error) throw new Error(saved.error);

      const rows = saved.bill?.rows || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('Upload an invoice before saving');
      }
      if (!saved.editedPdfBuffer?.byteLength) {
        throw new Error('Edited PDF was not created');
      }

      const uploads: File[] = [];
      const editedPdfFile = new File(
        [saved.editedPdfBuffer],
        saved.editedPdfName || 'edited-invoice.pdf',
        { type: 'application/pdf' },
      );
      uploads.push(editedPdfFile);

      let sourcePdfFile: File | null = null;
      if (saved.pdfBuffer?.byteLength) {
        sourcePdfFile = new File(
          [saved.pdfBuffer],
          saved.pdfName || 'invoice.pdf',
          { type: 'application/pdf' },
        );
        uploads.push(sourcePdfFile);
      }

      let headerFile: File | null = null;
      if (saved.headerDataUrl) {
        const blob = dataUrlToBlob(saved.headerDataUrl);
        if (blob) {
          headerFile = new File([blob], 'header.jpg', {
            type: blob.type || 'image/jpeg',
          });
          uploads.push(headerFile);
        }
      }

      const uploaded = await Promise.all(
        uploads.map((file) =>
          uploadFile(file, {
            allowedTypes: [
              'application/pdf',
              'image/jpeg',
              'image/jpg',
              'image/png',
              'image/webp',
            ],
          }),
        ),
      );

      let uploadIndex = 0;
      const editedPdfKey = uploaded[uploadIndex++]?.key || null;
      const sourcePdfKey = sourcePdfFile
        ? uploaded[uploadIndex++]?.key || null
        : null;
      const headerImageKey = headerFile
        ? uploaded[uploadIndex++]?.key || null
        : null;

      const payload = {
        ...saved.bill,
        sourcePdfFileName: saved.pdfName || null,
        sourcePdfBytes: saved.pdfBuffer?.byteLength ?? null,
        editedPdfFileName: saved.editedPdfName || null,
        editedPdfKey,
        sourcePdfKey,
        headerImageKey,
      };

      if (isNew) {
        const res = await api.post('/anjani-bills', payload, {
          toastSummary: 'Bill saved',
        });
        return unwrap<AnjaniBillRecord>(res.data);
      }
      const res = await api.patch(`/anjani-bills/${billId}`, payload, {
        toastSummary: 'Bill updated',
      });
      return unwrap<AnjaniBillRecord>(res.data);
    },
    onSuccess: async (saved) => {
      setError('');
      await qc.invalidateQueries({ queryKey: ['anjani-bills'] });
      await qc.invalidateQueries({ queryKey: ['anjani-bill', saved.id] });
      if (isNew) router.replace(`/edit-bill/anjani/${saved.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Save failed')),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div
        className="no-print"
        style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}
      >
        <div>
          <h1 style={{ margin: 0 }}>
            {isNew ? 'New Anjani bill' : `Bill ${detailQuery.data?.billNo || billId}`}
          </h1>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Header and bank details come from this bill, or from your company profile when the bill does not have them.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            label="Save"
            icon="pi pi-save"
            loading={saveMutation.isPending}
            disabled={!frameReady || saveMutation.isPending || detailQuery.isLoading}
            onClick={() => saveMutation.mutate()}
          />
          <Button label="Back" text onClick={() => router.push('/edit-bill/anjani')} />
        </div>
      </div>
      {error ? <p style={{ color: '#b42318', margin: 0 }}>{error}</p> : null}
      {detailQuery.isLoading ? <p className="muted">Loading bill…</p> : null}
      <iframe
        ref={frameRef}
        title="Anjani bill editor"
        src="/billedit/index.html"
        onLoad={() => setFrameReady(true)}
        style={{
          width: '100%',
          height: 'calc(100vh - 140px)',
          border: 0,
          background: '#e6e1da',
        }}
      />
    </div>
  );
}
