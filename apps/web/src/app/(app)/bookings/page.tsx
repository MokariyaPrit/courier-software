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
  SearchSelect,
  Textarea,
  type SearchSelectOption,
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
  primaryPhone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  cityId?: string | null;
  stateId?: string | null;
  pincode?: string | null;
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

interface DestCityOpt {
  id: string;
  cityId: string;
  stateId: string | null;
  label: string;
  stateName: string | null;
  rateColumnId: string;
}

interface SenderLocOpt {
  id: string;
  cityId: string;
  label: string;
  stateId: string | null;
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
  customerLabel: '',
  quotationId: '',
  senderLocationId: '',
  receiverId: '',
  rateSectionId: '',
  rateSectionLabel: '',
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
  destLabel: '',
  weightKg: 0.1,
  pieces: 1,
  codAmount: 0,
  freight: 0,
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
    setForm({ ...emptyForm, bookingType: mode, bookingDate: todayIso() });
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
        pageSize: 500,
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
        pageSize: 500,
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
  });

  const destCitiesQuery = useQuery({
    queryKey: ['rate-columns-booking'],
    queryFn: async () => {
      const res = await api.get('/rate-columns/booking-options');
      const payload = unwrap<DestCityOpt[] | { data: DestCityOpt[] }>(res.data);
      if (Array.isArray(payload)) return payload;
      if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload.data;
      }
      return [];
    },
  });

  const centersQuery = useQuery({
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

  const cashRatesQuery = useQuery({
    queryKey: ['cash-rates-booking'],
    queryFn: async () => {
      const res = await api.get('/quotation-templates/cash/mine');
      return unwrap<RateSource>(res.data);
    },
    enabled: mode === BookingType.CASH,
  });

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
        const snap =
          q.snapshot && (q.snapshot.columns || q.snapshot.rows)
            ? q.snapshot
            : q;
        setRateSource(snap);
        setFreightAuto(true);
        const status = (q as { status?: string }).status;
        setRateHint(
          status === 'ISSUED'
            ? 'Rates from latest issued quotation'
            : 'Rates from latest quotation (not issued yet)',
        );
      } catch {
        if (cancelled) return;
        setForm((p) => ({ ...p, quotationId: '' }));
        setRateSource(null);
        setRateHint('No quotation found for this customer');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, form.customerId, cashRatesQuery.data]);

  const matrix = useMemo(() => {
    if (!rateSource) return null;
    const src = rateSource.snapshot || rateSource;
    const rows = src.rows ?? [];
    if (!(src.columns?.length) && !rows.length) return null;
    return toMatrixForm({
      columns: src.columns,
      sections: src.sections,
      rows: rows.map((r) => ({
        ...r,
        weightLabel: r.weightLabel || `Up to ${r.weightGrams ?? 0} gms`,
      })),
    });
  }, [rateSource]);

  useEffect(() => {
    if (!freightAuto || !matrix || !form.rateSectionId) return;
    if (!form.receiverCityId && !form.receiverStateId) return;
    const resolved = resolveRate(matrix, {
      sectionId: form.rateSectionId,
      weightKg: form.weightKg,
      receiverCityId: form.receiverCityId || null,
      receiverStateId: form.receiverStateId || null,
      receiverCityName: form.receiverCity || form.destLabel || null,
      receiverStateName: form.receiverState || null,
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
    form.receiverCity,
    form.receiverState,
    form.destLabel,
  ]);

  const customerOptions: SearchSelectOption[] = useMemo(
    () =>
      (customersQuery.data?.data ?? []).map((c) => ({
        value: c.id,
        label: c.name,
        subLabel: c.city || c.primaryPhone || undefined,
      })),
    [customersQuery.data],
  );

  const receiverNameOptions: SearchSelectOption[] = useMemo(
    () =>
      (receiversQuery.data?.data ?? []).map((r) => ({
        value: r.id,
        label: r.name,
        subLabel: [r.city, r.phone].filter(Boolean).join(' · ') || undefined,
      })),
    [receiversQuery.data],
  );

  const destOptions: SearchSelectOption[] = useMemo(
    () =>
      (destCitiesQuery.data ?? []).map((d) => ({
        value: d.cityId,
        label: d.label,
        subLabel: d.stateName || undefined,
      })),
    [destCitiesQuery.data],
  );

  const sectionOptions: SearchSelectOption[] = useMemo(
    () =>
      (matrix?.sections ?? []).map((s) => ({
        value: s.id,
        label: s.label,
      })),
    [matrix],
  );

  const applyCustomer = (opt: SearchSelectOption | null) => {
    if (!opt) {
      setForm((p) => ({
        ...p,
        customerId: '',
        customerLabel: p.customerLabel,
        quotationId: '',
        senderLocationId: '',
        senderName: '',
        senderPhone: '',
        senderAddress: '',
        rateSectionId: '',
        rateSectionLabel: '',
      }));
      return;
    }
    const c = (customersQuery.data?.data ?? []).find((x) => x.id === opt.value);
    const center = (centersQuery.data ?? []).find(
      (l) => l.cityId && l.cityId === c?.cityId,
    );
    setForm((p) => ({
      ...p,
      customerId: opt.value,
      customerLabel: opt.label,
      rateSectionId: '',
      rateSectionLabel: '',
      senderLocationId: center?.id || '',
      senderName: c?.name || opt.label,
      senderPhone: c?.primaryPhone || '',
      senderAddress:
        [c?.address, c?.city, c?.state, c?.pincode].filter(Boolean).join(', ') ||
        '',
    }));
  };

  const applyReceiverSuggestion = (opt: SearchSelectOption | null) => {
    if (!opt) {
      setForm((p) => ({ ...p, receiverId: '' }));
      return;
    }
    const r = (receiversQuery.data?.data ?? []).find((x) => x.id === opt.value);
    setFreightAuto(true);
    setForm((p) => ({
      ...p,
      receiverId: opt.value,
      receiverName: r?.name || opt.label,
      receiverPhone: r?.phone || p.receiverPhone,
      receiverAddress: r?.address || p.receiverAddress,
      receiverPincode: r?.pincode || p.receiverPincode,
      // Keep destination from rate-columns pick if already set; else from receiver
      receiverCityId: p.receiverCityId || r?.cityId || '',
      receiverStateId: p.receiverStateId || r?.stateId || '',
      receiverCity: p.receiverCity || r?.city || '',
      receiverState: p.receiverState || r?.state || '',
      destLabel: p.destLabel || r?.city || '',
    }));
  };

  const applyDestination = (opt: SearchSelectOption | null) => {
    if (!opt) {
      setForm((p) => ({
        ...p,
        receiverCityId: '',
        receiverStateId: '',
        receiverCity: '',
        receiverState: '',
        destLabel: p.destLabel,
      }));
      return;
    }
    const d = (destCitiesQuery.data ?? []).find((x) => x.cityId === opt.value);
    setFreightAuto(true);
    setForm((p) => ({
      ...p,
      destLabel: opt.label,
      receiverCityId: opt.value,
      receiverStateId: d?.stateId || '',
      receiverCity: d?.label || opt.label,
      receiverState: d?.stateName || '',
    }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleaned = trimFormData(form);
      if (cleaned.bookingType === BookingType.ACCOUNT && !cleaned.customerId) {
        throw new Error('Select a customer');
      }
      if (cleaned.bookingType === BookingType.CASH && !cleaned.partyName) {
        throw new Error('Party name is required for cash booking');
      }
      if (!cleaned.receiverName.trim()) {
        throw new Error('Receiver name is required');
      }
      if (!cleaned.receiverCityId) {
        throw new Error('Select a destination city from Rate columns');
      }

      const receiverRes = await api.post(
        '/receivers/find-or-create',
        {
          name: cleaned.receiverName,
          phone: cleaned.receiverPhone || undefined,
          address: cleaned.receiverAddress || undefined,
          city: cleaned.receiverCity || undefined,
          state: cleaned.receiverState || undefined,
          cityId: cleaned.receiverCityId || undefined,
          stateId: cleaned.receiverStateId || undefined,
          pincode: cleaned.receiverPincode || undefined,
        },
        { skipToast: true },
      );
      const receiver = unwrap<ReceiverOpt>(receiverRes.data);

      let senderLocationId = cleaned.senderLocationId || undefined;
      let senderName = cleaned.senderName;
      let senderPhone = cleaned.senderPhone || undefined;
      let senderAddress = cleaned.senderAddress || undefined;

      if (cleaned.bookingType === BookingType.ACCOUNT && cleaned.customerId) {
        const c = (customersQuery.data?.data ?? []).find(
          (x) => x.id === cleaned.customerId,
        );
        const center = (centersQuery.data ?? []).find(
          (l) => l.cityId && l.cityId === c?.cityId,
        );
        senderLocationId = center?.id || senderLocationId;
        senderName = c?.name || senderName || 'Sender';
        senderPhone = c?.primaryPhone || senderPhone;
        senderAddress =
          [c?.address, c?.city, c?.state, c?.pincode]
            .filter(Boolean)
            .join(', ') || senderAddress;
      } else if (cleaned.bookingType === BookingType.CASH) {
        senderName = cleaned.partyName || senderName || 'Cash party';
        senderPhone = cleaned.partyPhone || senderPhone;
        senderAddress =
          [
            cleaned.partyAddress,
            cleaned.partyCity,
            cleaned.partyState,
            cleaned.partyPincode,
          ]
            .filter(Boolean)
            .join(', ') || senderAddress;
      }

      await api.post(
        '/consignments',
        {
          bookingType: cleaned.bookingType,
          bookingDate: cleaned.bookingDate || todayIso(),
          customerId:
            cleaned.bookingType === BookingType.ACCOUNT
              ? cleaned.customerId || undefined
              : undefined,
          quotationId: cleaned.quotationId || undefined,
          senderLocationId,
          receiverId: receiver.id,
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
          senderName: senderName || 'Sender',
          senderPhone,
          senderAddress,
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
          serviceType: ServiceType.STANDARD,
          remarks: cleaned.remarks || undefined,
          charges: [
            {
              type: ChargeType.FREIGHT,
              amount: cleaned.freight,
              description: 'Freight',
            },
          ],
        },
        {
          toastSummary: 'Success',
          toastDetail:
            cleaned.bookingType === BookingType.ACCOUNT
              ? 'Account booking created successfully.'
              : 'Cash booking created successfully.',
        },
      );
    },
    onSuccess: async () => {
      setForm({ ...emptyForm, bookingType: mode, bookingDate: todayIso() });
      setFreightAuto(true);
      setError('');
      await qc.invalidateQueries({ queryKey: ['consignments-recent'] });
      await qc.invalidateQueries({ queryKey: ['consignments'] });
      await qc.invalidateQueries({ queryKey: ['receivers'] });
      await qc.invalidateQueries({ queryKey: ['receivers-booking'] });
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
          <p className="muted" style={{ marginTop: 0 }}>
            Type to search — Tab or Enter selects the first result.
          </p>

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

            {mode === BookingType.ACCOUNT ? (
              <div className="field">
                <label>Customer</label>
                <SearchSelect
                  value={form.customerLabel}
                  options={customerOptions}
                  placeholder="Type customer name…"
                  allowFreeText={false}
                  emptyHint="No customers match"
                  onChange={(text) =>
                    setForm((p) => ({
                      ...p,
                      customerLabel: text,
                      customerId: '',
                    }))
                  }
                  onSelect={applyCustomer}
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
                  <label>Party GSTIN</label>
                  <InputText
                    value={form.partyGstin}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, partyGstin: e.target.value }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>
              </>
            )}

            <div className="field">
              <label>Receiver name</label>
              <SearchSelect
                value={form.receiverName}
                options={receiverNameOptions}
                placeholder="Type receiver name…"
                allowFreeText
                emptyHint="New receiver will be created"
                onChange={(text) =>
                  setForm((p) => ({
                    ...p,
                    receiverName: text,
                    receiverId: '',
                  }))
                }
                onSelect={applyReceiverSuggestion}
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
              <label>Destination</label>
              <SearchSelect
                value={form.destLabel}
                options={destOptions}
                placeholder="Type destination from Rate columns…"
                allowFreeText={false}
                emptyHint="Configure Rate columns first"
                onChange={(text) =>
                  setForm((p) => ({
                    ...p,
                    destLabel: text,
                    receiverCityId: '',
                  }))
                }
                onSelect={applyDestination}
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
              <SearchSelect
                value={form.rateSectionLabel}
                options={sectionOptions}
                placeholder="DOX / PARCEL / …"
                allowFreeText={false}
                emptyHint={
                  matrix ? 'No sections' : 'Select customer / cash rates first'
                }
                onChange={(text) =>
                  setForm((p) => ({
                    ...p,
                    rateSectionLabel: text,
                    rateSectionId: '',
                  }))
                }
                onSelect={(opt) => {
                  setFreightAuto(true);
                  if (!opt) {
                    setForm((p) => ({
                      ...p,
                      rateSectionId: '',
                      rateSectionLabel: p.rateSectionLabel,
                    }));
                    return;
                  }
                  setForm((p) => ({
                    ...p,
                    rateSectionId: opt.value,
                    rateSectionLabel: opt.label,
                  }));
                }}
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
              <label>Price {freightAuto ? '(auto)' : '(manual)'}</label>
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
          {freightAuto &&
          form.rateSectionId &&
          form.receiverCityId &&
          matrix &&
          form.freight === 0 ? (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              No rate found for this destination / section / weight on the
              quotation (tried city → state → ROI). Check the issued quotation
              matrix cells are filled for that weight band.
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
