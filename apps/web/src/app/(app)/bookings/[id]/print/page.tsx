'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import {
  BookingReceiptSlip,
  type BookingReceiptDoc,
} from '@/components/bookings/BookingReceiptSlip';
import '@/components/bookings/booking-receipt.css';
import { useParams, useRouter } from 'next/navigation';
import { api, unwrap } from '@/lib/api';

export default function BookingReceiptPrintPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || '');

  const docQuery = useQuery({
    queryKey: ['booking-document', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/consignments/${id}/document`);
      return unwrap<BookingReceiptDoc>(res.data);
    },
  });

  const doc = docQuery.data;

  return (
    <div className="br-print-page">
      <div className="br-print-chrome no-print">
        <div>
          <h1>Booking receipt</h1>
          <p className="muted" style={{ margin: 0 }}>
            {doc?.consignment.awb
              ? `AWB ${doc.consignment.awb}`
              : 'Preview, then print'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            label="Back"
            icon="pi pi-arrow-left"
            outlined
            severity="secondary"
            onClick={() => router.back()}
          />
          <Button
            label="Print"
            icon="pi pi-print"
            disabled={!doc}
            onClick={() => window.print()}
          />
        </div>
      </div>

      {docQuery.isLoading ? (
        <p className="br-preview-label">Loading receipt…</p>
      ) : null}
      {docQuery.isError ? (
        <p className="br-preview-label">Could not load booking receipt.</p>
      ) : null}

      {doc ? (
        <>
          <div className="br-preview-label no-print">
            Preview — this is the slip that prints at the top of A4
          </div>
          <div className="br-preview-scale">
            <BookingReceiptSlip doc={doc} />
          </div>
        </>
      ) : null}
    </div>
  );
}
