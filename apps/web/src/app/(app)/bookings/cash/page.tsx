'use client';

import { BookingType } from '@courier/shared';
import { Suspense } from 'react';
import { BookingsPageView } from '@/components/bookings/BookingsPageView';

export default function CashBookingsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <BookingsPageView mode={BookingType.CASH} />
    </Suspense>
  );
}
