'use client';

import { ConsignmentStatus } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { api, unwrap } from '@/lib/api';

interface OfdRow {
  id: string;
  awb: string;
  receiverName: string;
  receiverPhone: string | null;
  receiverAddress: string | null;
}

export default function DeliveryPage() {
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['ofd'],
    queryFn: async () => {
      const res = await api.get('/delivery/ofd');
      return unwrap<OfdRow[]>(res.data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      status: ConsignmentStatus;
    }) => {
      await api.patch(`/consignments/${payload.id}/status`, {
        status: payload.status,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ofd'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
    },
  });

  return (
    <div>
      <div className="page-header">
        <h1>Out for delivery</h1>
      </div>
      <div className="panel">
        <DataTable value={listQuery.data ?? []} loading={listQuery.isLoading} emptyMessage="No OFD consignments">
          <Column field="awb" header="AWB" />
          <Column field="receiverName" header="Receiver" />
          <Column field="receiverPhone" header="Phone" />
          <Column field="receiverAddress" header="Address" />
          <Column
            header="Actions"
            body={(row: OfdRow) => (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  size="small"
                  label="Delivered"
                  onClick={() =>
                    updateMutation.mutate({
                      id: row.id,
                      status: ConsignmentStatus.DELIVERED,
                    })
                  }
                />
                <Button
                  size="small"
                  severity="warning"
                  label="Failed"
                  onClick={() =>
                    updateMutation.mutate({
                      id: row.id,
                      status: ConsignmentStatus.FAILED_ATTEMPT,
                    })
                  }
                />
              </div>
            )}
          />
        </DataTable>
      </div>
    </div>
  );
}
