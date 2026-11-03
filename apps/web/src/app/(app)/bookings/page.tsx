'use client';

import { BookingType } from '@courier/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function BookingsRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const type = searchParams.get('type');
    const edit = searchParams.get('edit');
    const base =
      type === BookingType.CASH ? '/bookings/cash' : '/bookings/account';
    const qs = edit ? `?edit=${encodeURIComponent(edit)}` : '';
    router.replace(`${base}${qs}`);
  }, [router, searchParams]);

  return <p className="muted">Opening booking…</p>;
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <BookingsRedirectInner />
    </Suspense>
  );
}
