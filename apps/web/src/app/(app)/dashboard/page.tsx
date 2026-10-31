'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

interface Counts {
  total: number;
  bookedToday: number;
  inTransit: number;
  ofd: number;
  delivered: number;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-counts'],
    queryFn: async () => {
      const res = await api.get('/consignments/dashboard/counts');
      return unwrap<Counts>(res.data);
    },
  });

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>
      {isLoading ? (
        <p className="muted">Loading counts…</p>
      ) : (
        <div className="stats">
          <div className="stat-card">
            <span>Total consignments</span>
            <strong>{data?.total ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>Booked today</span>
            <strong>{data?.bookedToday ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>In transit</span>
            <strong>{data?.inTransit ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>Out for delivery</span>
            <strong>{data?.ofd ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>Delivered</span>
            <strong>{data?.delivered ?? 0}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
