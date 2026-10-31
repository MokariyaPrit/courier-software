'use client';

import {
  BOOKING_TYPE_LABELS,
  BookingType,
  ChargeType,
  ServiceType,
} from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  InputNumber,
  InputText,
  Select,
  Textarea,
} from '@/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { fetchPaginated } from '@/lib/list';
import { resolveRate, toMatrixForm } from '@/lib/quotations';
import { trimFormData } from '@/lib/trim';

interface ConsignmentRow {
  id: string;
  awb: string;
  status: string;
  bookingType?: BookingType;
  receiverName: string;
  bookingDate?: string | null;
  createdAt: string;
  customer?: { name: string } | null;
  partyName?: string | null;
}

interface CustomerOpt {
  id: string;
  name: string;
}
interface ReceiverOpt {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cityId: string | null;
  stateId: string | null;
  pincode: string | null;
}
interface SenderLocOpt {
  id: string;
  label: string;
  cityId: string;
  stateId: string | null;
  rateColumnId: string;
  isDefault: boolean;
  cityRef?: { name: string } | null;
  state?: { name: string } | null;
}
interface GeoOpt {
  id: string;
  name: string;
  stateId?: string;
}
interface RateSource {
  id?: string;
  columns?: Array<{ id: string; label: string; sortOrder: number }>;
  sections?: Array<{ id: string; label: string; sortOrder: number }>;
  rows?: Array<{
    sectionId: string;
    weightLabel?: string;
    weightGrams?: number | null;
    isAdditional?: boolean;
    sortOrder?: number;
    rates: Record<string, string | number>;
  }>;
  snapshot?: RateSource;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  bookingType: BookingType.ACCOUNT as BookingType,
  bookingDate: todayIso(),
  customerId: '',
  quotationId: '',
  senderLocationId: '',
  receiverId: '',
  rateSectionId: '',
  rateColumnId: '',
  partyName: '',
  partyPhone: '',
  partyAddress: '',
  partyCity: '',
  partyState: '',
  partyPincode: '',
  partyGstin: '',
  partyEmail: '',
  senderName: '',
  senderPhone: '',
  senderAddress: '',
  receiverName: '',
  receiverPhone: '',
  receiverAddress: '',
  receiverCity: '',
  receiverState: '',
  receiverPincode: '',
  receiverCityId: '',
  receiverStateId: '',
  weightKg: 1,
  pieces: 1,
  codAmount: 0,
  freight: 0,
  serviceType: ServiceType.STANDARD,
  remarks: '',
};

export default function BookingsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const mode: BookingType =
    typeParam === BookingType.CASH ? BookingType.CASH : BookingType.ACCOUNT;

  const [form, setForm] = useState({ ...emptyForm, bookingType: mode });
  const [error, setError] = useState('');
  const [rateSource, setRateSource] = useState<RateSource | null>(null);
  const [rateHint, setRateHint] = useState('');
  const [freightAuto, setFreightAuto] = useState(true);

  useEffect(() => {
    setForm((p) => ({
      ...emptyForm,
      bookingType: mode,
      bookingDate: todayIso(),
      senderLocationId: p.senderLocationId,
      senderName: p.senderName,
      senderPhone: p.senderPhone,
      senderAddress: p.senderAddress,
    }));
    setRateSource(null);
    setRateHint('');
    setError('');
    setFreightAuto(true);
  }, [mode]);

  const setMode = (next: BookingType) => {
    router.replace(`/bookings?type=${next}`);
  };

  const recentQuery = useQuery({
    queryKey: ['consignments-recent', mode],
    queryFn: () =>
      fetchPaginated<ConsignmentRow>('/consignments', {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        mine: true,
        bookingType: mode,
      }),
  });

  const customersQuery = useQuery({
    queryKey: ['customers-booking'],
    queryFn: () =>
      fetchPaginated<CustomerOpt>('/customers', {
        page: 1,
        pageSize: 300,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
    enabled: mode === BookingType.ACCOUNT,
  });

  const receiversQuery = useQuery({
    queryKey: ['receivers-booking'],
    queryFn: () =>
      fetchPaginated<ReceiverOpt>('/receivers', {
        page: 1,
        pageSize: 300,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
  });

  const senderLocQuery = useQuery({
    queryKey: ['sender-locations-booking'],
    queryFn: async () => {
      const res = await api.get('/sender-locations/booking-options');
      const payload = unwrap<SenderLocOpt[] | { data: SenderLocOpt[] }>(
        res.data,
      );
      if (Array.isArray(payload)) return payload;
      if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload.data;
      }
      return [];
    },
  });

  const statesQuery = useQuery({
    queryKey: ['states-booking'],
    queryFn: () =>
      fetchPaginated<GeoOpt>('/states', {
        page: 1,
        pageSize: 500,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
  });

  const citiesQuery = useQuery({
    queryKey: ['cities-booking', form.receiverStateId],
    queryFn: () =>
      fetchPaginated<GeoOpt>('/cities', {
        page: 1,
        pageSize: 500,
        sortBy: 'name',
        sortOrder: 'ASC',
        ...(form.receiverStateId
          ? { stateId: form.receiverStateId }
          : {}),
      }),
  });

  const cashRatesQuery = useQuery({
    queryKey: ['cash-rates-booking'],
    queryFn: async () => {
      const res = await api.get('/quotation-templates/cash/mine');
      return unwrap<RateSource>(res.data);
    },
    enabled: mode === BookingType.CASH,
  });

  // Default center when centers load
  useEffect(() => {
    const locs = senderLocQuery.data ?? [];
    if (!locs.length || form.senderLocationId) return;
    const def = locs.find((l) => l.isDefault) || locs[0];
    setForm((p) => ({
      ...p,
      senderLocationId: def.id,
      senderName: def.label,
      senderAddress: [def.cityRef?.name, def.state?.name]
        .filter(Boolean)
        .join(', '),
    }));
  }, [senderLocQuery.data, form.senderLocationId]);

  // Account quotation / cash matrix
  useEffect(() => {
    if (mode === BookingType.CASH) {
      if (cashRatesQuery.data) {
        setRateSource(cashRatesQuery.data);
        setRateHint('Rates from your cash template');
      }
      return;
    }
    if (!form.customerId) {
      setRateSource(null);
      setRateHint('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(
          `/quotations/customer/${form.customerId}/latest-issued`,
        );
        const q = unwrap<RateSource & { id: string; snapshot?: RateSource }>(
          res.data,
        );
        if (cancelled) return;
        setForm((p) => ({ ...p, quotationId: q.id }));
        setRateSource(q.snapshot || q);
        setRateHint('Rates from latest issued quotation');
      } catch {
        if (cancelled) return;
        setForm((p) => ({ ...p, quotationId: '' }));
        setRateSource(null);
        setRateHint('No issued quotation for this customer');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, form.customerId, cashRatesQuery.data]);

  const matrix = useMemo(() => {
    if (!rateSource) return null;
    const src = rateSource.snapshot || rateSource;
    return toMatrixForm({
      columns: src.columns,
      sections: src.sections,
      rows: (src.rows ?? []).map((r) => ({
        ...r,
        weightLabel: r.weightLabel || `Up to ${r.weightGrams ?? 0} gms`,
      })),
    });
  }, [rateSource]);

  // Auto freight: city → state → ROI
  useEffect(() => {
    if (!freightAuto || !matrix || !form.rateSectionId) return;
    const resolved = resolveRate(matrix, {
      sectionId: form.rateSectionId,
      weightKg: form.weightKg,
      receiverCityId: form.receiverCityId || null,
      receiverStateId: form.receiverStateId || null,
    });
    setForm((p) => ({
      ...p,
      freight: resolved.amount,
      rateColumnId: resolved.columnId,
    }));
  }, [
    freightAuto,
    matrix,
    form.rateSectionId,
    form.weightKg,
    form.receiverCityId,
    form.receiverStateId,
  ]);

  const applySenderLocation = (id: string) => {
    const loc = (senderLocQuery.data ?? []).find((l) => l.id === id);
    setForm((p) => ({
      ...p,
      senderLocationId: id,
      senderName: loc?.label || p.senderName,
      senderAddress:
        [loc?.cityRef?.name || loc?.label, loc?.state?.name]
          .filter(Boolean)
          .join(', ') || p.senderAddress,
    }));
  };

  const applyReceiver = (id: string) => {
    const r = (receiversQuery.data?.data ?? []).find((x) => x.id === id);
    setFreightAuto(true);
    setForm((p) => ({
      ...p,
      receiverId: id,
      receiverName: r?.name || p.receiverName,
      receiverPhone: r?.phone || p.receiverPhone,
      receiverAddress: r?.address || p.receiverAddress,
      receiverCity: r?.city || p.receiverCity,
      receiverState: r?.state || p.receiverState,
      receiverPincode: r?.pincode || p.receiverPincode,
      receiverCityId: r?.cityId || '',
      receiverStateId: r?.stateId || '',
    }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleaned = trimFormData(form);
      if (cleaned.bookingType === BookingType.ACCOUNT && !cleaned.customerId) {
        throw new Error('Select a customer for account booking');
      }
      if (cleaned.bookingType === BookingType.CASH && !cleaned.partyName) {
        throw new Error('Party name is required for cash booking');
      }
      if (!cleaned.senderLocationId) {
        throw new Error('Select a sender center');
      }
      if (!cleaned.receiverName) {
        throw new Error('Receiver name is required');
      }

      await api.post('/consignments', {
        bookingType: cleaned.bookingType,
        bookingDate: cleaned.bookingDate || todayIso(),
        customerId:
          cleaned.bookingType === BookingType.ACCOUNT
            ? cleaned.customerId || undefined
            : undefined,
        quotationId: cleaned.quotationId || undefined,
        senderLocationId: cleaned.senderLocationId || undefined,
        receiverId: cleaned.receiverId || undefined,
        rateSectionId: cleaned.rateSectionId || undefined,
        rateColumnId: cleaned.rateColumnId || undefined,
        partyName:
          cleaned.bookingType === BookingType.CASH
            ? cleaned.partyName
            : undefined,
        partyPhone:
          cleaned.bookingType === BookingType.CASH
            ? cleaned.partyPhone || undefined
            : undefined,
        partyAddress:
          cleaned.bookingType === BookingType.CASH
            ? cleaned.partyAddress || undefined
            : undefined,
        partyCity:
          cleaned.bookingType === BookingType.CASH
            ? cleaned.partyCity || undefined
            : undefined,
        partyState:
          cleaned.bookingType === BookingType.CASH
            ? cleaned.partyState || undefined
            : undefined,
        partyPincode:
          cleaned.bookingType === BookingType.CASH
            ? cleaned.partyPincode || undefined
            : undefined,
        partyGstin:
          cleaned.bookingType === BookingType.CASH
            ? cleaned.partyGstin || undefined
            : undefined,
        partyEmail:
          cleaned.bookingType === BookingType.CASH
            ? cleaned.partyEmail || undefined
            : undefined,
        senderName: cleaned.senderName || cleaned.partyName || 'Sender',
        senderPhone: cleaned.senderPhone || undefined,
        senderAddress: cleaned.senderAddress || undefined,
        receiverName: cleaned.receiverName,
        receiverPhone: cleaned.receiverPhone || undefined,
        receiverAddress: cleaned.receiverAddress || undefined,
        receiverCity: cleaned.receiverCity || undefined,
        receiverState: cleaned.receiverState || undefined,
        receiverPincode: cleaned.receiverPincode || undefined,
        receiverCityId: cleaned.receiverCityId || undefined,
        receiverStateId: cleaned.receiverStateId || undefined,
        weightKg: cleaned.weightKg,
        pieces: cleaned.pieces,
        codAmount: cleaned.codAmount,
        serviceType: cleaned.serviceType,
        remarks: cleaned.remarks || undefined,
        charges: [
          {
            type: ChargeType.FREIGHT,
            amount: cleaned.freight,
            description: 'Freight',
          },
        ],
      });
    },
    onSuccess: async () => {
      const keepCenter = form.senderLocationId;
      const keepSender = {
        senderName: form.senderName,
        senderPhone: form.senderPhone,
        senderAddress: form.senderAddress,
      };
      setForm({
        ...emptyForm,
        bookingType: mode,
        bookingDate: todayIso(),
        senderLocationId: keepCenter,
        ...keepSender,
      });
      setFreightAuto(true);
      setError('');
      await qc.invalidateQueries({ queryKey: ['consignments-recent'] });
      await qc.invalidateQueries({ queryKey: ['consignments'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error && !('response' in err)
          ? err.message
          : (err as { response?: { data?: { error?: { message?: string } } } })
              ?.response?.data?.error?.message || 'Failed to create booking';
      setError(message);
    },
  });

  const sectionOptions = (matrix?.sections ?? []).map((s) => ({
    label: s.label,
    value: s.id,
  }));

  const stateOptions = (statesQuery.data?.data ?? []).map((s) => ({
    label: s.name,
    value: s.id,
  }));
  const cityOptions = (citiesQuery.data?.data ?? []).map((c) => ({
    label: c.name,
    value: c.id,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Bookings</h1>
        <div className="booking-mode-tabs">
          <Button
            label="Account Booking"
            outlined={mode !== BookingType.ACCOUNT}
            onClick={() => setMode(BookingType.ACCOUNT)}
          />
          <Button
            label="Cash Booking"
            outlined={mode !== BookingType.CASH}
            onClick={() => setMode(BookingType.CASH)}
          />
        </div>
      </div>

      <div className="bookings-split">
        <div className="bookings-split-form panel">
          <h2>
            {mode === BookingType.ACCOUNT
              ? 'New account booking'
              : 'New cash booking'}
          </h2>

          <div className="form-grid">
            <div className="field">
              <label>Booking date</label>
              <InputText
                type="date"
                value={form.bookingDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, bookingDate: e.target.value }))
                }
                style={{ width: '100%' }}
              />
            </div>
            <div className="field">
              <label>Sender center</label>
              <Select
                value={form.senderLocationId || null}
                options={(senderLocQuery.data ?? []).map((l) => ({
                  label: l.label,
                  value: l.id,
                }))}
                onChange={(e) => applySenderLocation(String(e.value || ''))}
                placeholder="Select center city"
                style={{ width: '100%' }}
              />
            </div>

            {mode === BookingType.ACCOUNT ? (
              <div className="field full">
                <label>Customer (bill-to)</label>
                <Select
                  value={form.customerId || null}
                  options={(customersQuery.data?.data ?? []).map((c) => ({
                    label: c.name,
                    value: c.id,
                  }))}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      customerId: String(e.value || ''),
                      rateSectionId: '',
                    }))
                  }
                  placeholder="Select customer"
                  filter
                  style={{ width: '100%' }}
                />
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Party name</label>
                  <InputText
                    value={form.partyName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partyName: e.target.value }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="field">
                  <label>Party phone</label>
                  <InputText
                    value={form.partyPhone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partyPhone: e.target.value }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="field full">
                  <label>Party address</label>
                  <InputText
                    value={form.partyAddress}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partyAddress: e.target.value }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="field">
                  <label>Party city</label>
                  <InputText
                    value={form.partyCity}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partyCity: e.target.value }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="field">
                  <label>Party state</label>
                  <InputText
                    value={form.partyState}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partyState: e.target.value }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="field">
                  <label>Party pincode</label>
                  <InputText
                    value={form.partyPincode}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partyPincode: e.target.value }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="field">
                  <label>Party GSTIN</label>
                  <InputText
                    value={form.partyGstin}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partyGstin: e.target.value }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="field full">
                  <label>Party email (optional)</label>
                  <InputText
                    value={form.partyEmail}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partyEmail: e.target.value }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>
              </>
            )}

            <div className="field full">
              <label>Receiver (master)</label>
              <Select
                value={form.receiverId || null}
                options={(receiversQuery.data?.data ?? []).map((r) => ({
                  label: `${r.name}${r.city ? ` — ${r.city}` : ''}`,
                  value: r.id,
                }))}
                onChange={(e) => applyReceiver(String(e.value || ''))}
                placeholder="Pick receiver or fill below"
                filter
                showClear
                style={{ width: '100%' }}
              />
            </div>

            <div className="field">
              <label>Receiver name</label>
              <InputText
                value={form.receiverName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, receiverName: e.target.value }))
                }
                style={{ width: '100%' }}
              />
            </div>
            <div className="field">
              <label>Receiver phone</label>
              <InputText
                value={form.receiverPhone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, receiverPhone: e.target.value }))
                }
                style={{ width: '100%' }}
              />
            </div>
            <div className="field full">
              <label>Receiver address</label>
              <InputText
                value={form.receiverAddress}
                onChange={(e) =>
                  setForm((p) => ({ ...p, receiverAddress: e.target.value }))
                }
                style={{ width: '100%' }}
              />
            </div>

            <div className="field">
              <label>Destination state</label>
              <Select
                value={form.receiverStateId || null}
                options={stateOptions}
                onChange={(e) => {
                  const stateId = String(e.value || '');
                  const st = (statesQuery.data?.data ?? []).find(
                    (s) => s.id === stateId,
                  );
                  setFreightAuto(true);
                  setForm((p) => ({
                    ...p,
                    receiverStateId: stateId,
                    receiverState: st?.name || '',
                    receiverCityId: '',
                    receiverCity: '',
                  }));
                }}
                placeholder="State"
                filter
                style={{ width: '100%' }}
              />
            </div>
            <div className="field">
              <label>Destination city</label>
              <Select
                value={form.receiverCityId || null}
                options={cityOptions}
                onChange={(e) => {
                  const cityId = String(e.value || '');
                  const city = (citiesQuery.data?.data ?? []).find(
                    (c) => c.id === cityId,
                  );
                  setFreightAuto(true);
                  setForm((p) => ({
                    ...p,
                    receiverCityId: cityId,
                    receiverCity: city?.name || '',
                    receiverStateId: city?.stateId || p.receiverStateId,
                  }));
                }}
                placeholder="City (for rate)"
                filter
                style={{ width: '100%' }}
                disabled={!form.receiverStateId && !cityOptions.length}
              />
            </div>
            <div className="field">
              <label>Pincode</label>
              <InputText
                value={form.receiverPincode}
                onChange={(e) =>
                  setForm((p) => ({ ...p, receiverPincode: e.target.value }))
                }
                style={{ width: '100%' }}
              />
            </div>

            <div className="field">
              <label>Service section</label>
              <Select
                value={form.rateSectionId || null}
                options={sectionOptions}
                onChange={(e) => {
                  setFreightAuto(true);
                  setForm((p) => ({
                    ...p,
                    rateSectionId: String(e.value || ''),
                  }));
                }}
                placeholder="DOX / PARCEL / …"
                style={{ width: '100%' }}
                disabled={!sectionOptions.length}
              />
            </div>
            <div className="field">
              <label>Weight (kg)</label>
              <InputNumber
                value={form.weightKg}
                onValueChange={(e) => {
                  setFreightAuto(true);
                  setForm((p) => ({
                    ...p,
                    weightKg: Number(e.value ?? 0),
                  }));
                }}
                min={0}
                minFractionDigits={0}
                maxFractionDigits={3}
                style={{ width: '100%' }}
                inputStyle={{ width: '100%' }}
              />
            </div>
            <div className="field">
              <label>Pieces</label>
              <InputNumber
                value={form.pieces}
                onValueChange={(e) =>
                  setForm((p) => ({ ...p, pieces: Number(e.value ?? 1) }))
                }
                min={1}
                style={{ width: '100%' }}
                inputStyle={{ width: '100%' }}
              />
            </div>
            <div className="field">
              <label>Freight {freightAuto ? '(auto)' : '(manual)'}</label>
              <InputNumber
                value={form.freight}
                onValueChange={(e) => {
                  setFreightAuto(false);
                  setForm((p) => ({
                    ...p,
                    freight: Number(e.value ?? 0),
                  }));
                }}
                min={0}
                minFractionDigits={0}
                maxFractionDigits={2}
                style={{ width: '100%' }}
                inputStyle={{ width: '100%' }}
              />
            </div>
            <div className="field">
              <label>COD amount</label>
              <InputNumber
                value={form.codAmount}
                onValueChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    codAmount: Number(e.value ?? 0),
                  }))
                }
                min={0}
                minFractionDigits={0}
                maxFractionDigits={2}
                style={{ width: '100%' }}
                inputStyle={{ width: '100%' }}
              />
            </div>
            <div className="field">
              <label>Service</label>
              <Select
                value={form.serviceType}
                options={Object.values(ServiceType).map((v) => ({
                  label: v,
                  value: v,
                }))}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    serviceType: e.value as ServiceType,
                  }))
                }
                style={{ width: '100%' }}
              />
            </div>
            <div className="field full">
              <label>Remarks</label>
              <Textarea
                value={form.remarks}
                onChange={(e) =>
                  setForm((p) => ({ ...p, remarks: e.target.value }))
                }
                rows={2}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {rateHint ? <p className="muted">{rateHint}</p> : null}
          {form.rateColumnId ? (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Rate column: {form.rateColumnId}
            </p>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}

          <div style={{ marginTop: '1rem' }}>
            <Button
              label="Create booking"
              icon="pi pi-check"
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            />
          </div>
        </div>

        <aside className="bookings-split-recent panel">
          <h2>Recent {BOOKING_TYPE_LABELS[mode].toLowerCase()}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Last {recentQuery.data?.data?.length ?? 0} of yours
          </p>
          <div className="booking-recent-list">
            {(recentQuery.data?.data ?? []).map((row) => (
              <Link
                key={row.id}
                href={`/tracking?awb=${row.awb}`}
                className="booking-recent-card"
              >
                <div className="booking-recent-awb">{row.awb}</div>
                <div className="booking-recent-meta">
                  <span>
                    {row.bookingType
                      ? BOOKING_TYPE_LABELS[row.bookingType]
                      : '—'}
                  </span>
                  <span>{row.status}</span>
                </div>
                <div className="booking-recent-receiver">
                  {row.receiverName}
                  {row.customer?.name
                    ? ` · ${row.customer.name}`
                    : row.partyName
                      ? ` · ${row.partyName}`
                      : ''}
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {row.bookingDate ||
                    new Date(row.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
            {!recentQuery.isLoading &&
            !(recentQuery.data?.data ?? []).length ? (
              <p className="muted">No recent bookings yet.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
