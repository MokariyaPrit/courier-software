'use client';

import { ConsignmentStatus } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { ListPaginator, ListToolbar } from '@/components/ListControls';
import { api } from '@/lib/api';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';

interface OfdRow {
  id: string;
  awb: string;
  receiverName: string;
  receiverPhone: string | null;
  receiverAddress: string | null;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Updated newest', sortBy: 'updatedAt', sortOrder: 'DESC' },
  { label: 'Updated oldest', sortBy: 'updatedAt', sortOrder: 'ASC' },
  { label: 'AWB Asc', sortBy: 'awb', sortOrder: 'ASC' },
  { label: 'AWB Desc', sortBy: 'awb', sortOrder: 'DESC' },
  { label: 'Receiver Asc', sortBy: 'receiverName', sortOrder: 'ASC' },
  { label: 'Receiver Desc', sortBy: 'receiverName', sortOrder: 'DESC' },
];

export default function DeliveryPage() {
  const qc = useQueryClient();
  const list = useListParams({ defaultSort: SORT_OPTIONS[0] });

  const listQuery = useQuery({
    queryKey: ['ofd', list.queryParams],
    queryFn: () =>
      fetchPaginated<OfdRow>('/delivery/ofd', {
        page: list.page,
        pageSize: list.pageSize,
        sortBy: list.sort.sortBy,
        sortOrder: list.sort.sortOrder,
      }),
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

  const meta = listQuery.data?.meta ?? {
    page: list.page,
    pageSize: list.pageSize,
    total: 0,
  };

  return (
    <div>
      <div className="page-header">
        <h1>Out for delivery</h1>
      </div>
      <ListToolbar
        sortKey={list.sortKey}
        onSortChange={list.setSortKey}
        sortOptions={SORT_OPTIONS}
      />
      <div className="panel">
        <DataTable
          value={listQuery.data?.data ?? []}
          loading={listQuery.isLoading}
          emptyMessage="No OFD consignments"
        >
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
        <ListPaginator
          meta={meta}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </div>
    </div>
  );
}
