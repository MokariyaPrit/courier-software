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
  ConfirmDialog,
  confirmDialog,
  InputNumber,
  InputText,
  SearchSelect,
  Textarea,
  type SearchSelectOption,
} from '@/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { fetchPaginated } from '@/lib/list';
import {
  resolveRate,
  serviceTypeLabel,
  toMatrixForm,
  weightLabelForGrams,
} from '@/lib/quotations';
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

interface ConsignmentDetail {
  id: string;
  awb: string;
  bookingType: BookingType;
  bookingDate?: string | null;
  customerId?: string | null;
  customer?: { id?: string; name?: string } | null;
  courierCompanyId?: string | null;
  courierCompany?: { id?: string; name?: string } | null;
  quotationId?: string | null;
  senderLocationId?: string | null;
  receiverId?: string | null;
  rateSectionId?: string | null;
  rateColumnId?: string | null;
  partyName?: string | null;
  partyPhone?: string | null;
  partyAddress?: string | null;
  partyCity?: string | null;
  partyState?: string | null;
  partyPincode?: string | null;
  partyGstin?: string | null;
  partyEmail?: string | null;
  senderName?: string;
  senderPhone?: string | null;
  senderAddress?: string | null;
  receiverName: string;
  receiverPhone?: string | null;
  receiverAddress?: string | null;
  receiverCity?: string | null;
  receiverState?: string | null;
  receiverCityId?: string | null;
  receiverStateId?: string | null;
  weightKg?: string | number | null;
  cgst?: string | number | null;
  sgst?: string | number | null;
  igst?: string | number | null;
  remarks?: string | null;
  charges?: Array<{ type: string; amount: string | number }>;
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

interface SenderLocOpt {
  id: string;
  cityId: string;
  label: string;
  stateId: string | null;
  stateName?: string | null;
}

interface CourierCompanyOpt {
  id: string;
  name: string;
  companyLink?: string | null;
  isActive: boolean;
  isDefaultForMe?: boolean;
  isHiddenForMe?: boolean;
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
  courierCompanyId: '',
  courierCompanyLabel: '',
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
  receiverCityId: '',
  receiverStateId: '',
  destLabel: '',
  documentNumber: '',
  weightGrams: 100,
  freight: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
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
  /** false = follow slab auto price; true = user override */
  const [priceManual, setPriceManual] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAwb, setEditingAwb] = useState('');

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

  const courierCompaniesQuery = useQuery({
    queryKey: ['courier-companies-booking'],
    queryFn: () =>
      fetchPaginated<CourierCompanyOpt>('/courier-companies', {
        page: 1,
        pageSize: 500,
        sortBy: 'name',
        sortOrder: 'ASC',
        activeOnly: true,
      }),
  });

  const defaultCourierCompany = useMemo(() => {
    const preferred = (courierCompaniesQuery.data?.data ?? []).find(
      (c) => c.isDefaultForMe,
    );
    if (!preferred) return { courierCompanyId: '', courierCompanyLabel: '' };
    return {
      courierCompanyId: preferred.id,
      courierCompanyLabel: preferred.name,
    };
  }, [courierCompaniesQuery.data]);

  const resetForm = () => {
    setForm({
      ...emptyForm,
      bookingType: mode,
      bookingDate: todayIso(),
      courierCompanyId: defaultCourierCompany.courierCompanyId,
      courierCompanyLabel: defaultCourierCompany.courierCompanyLabel,
    });
    setRateSource(null);
    setRateHint('');
    setError('');
    setPriceManual(false);
    setEditingId(null);
    setEditingAwb('');
  };

  useEffect(() => {
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on booking mode change only
  }, [mode]);

  useEffect(() => {
    if (editingId) return;
    if (!defaultCourierCompany.courierCompanyId) return;
    setForm((p) => {
      if (p.courierCompanyId) return p;
      return {
        ...p,
        courierCompanyId: defaultCourierCompany.courierCompanyId,
        courierCompanyLabel: defaultCourierCompany.courierCompanyLabel,
      };
    });
  }, [defaultCourierCompany, editingId]);

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
        weightLabel:
          r.weightGrams != null
            ? weightLabelForGrams(r.sectionId, r.weightGrams)
            : r.weightLabel || `${r.weightGrams ?? 0} g`,
      })),
    });
  }, [rateSource]);

  const resolvedPrice = useMemo(() => {
    if (!matrix || !form.rateSectionId) {
      return { amount: 0, columnId: '' };
    }
    if (!form.receiverCityId && !form.receiverStateId) {
      return { amount: 0, columnId: '' };
    }
    return resolveRate(matrix, {
      sectionId: form.rateSectionId,
      weightKg: Math.max(0, Number(form.weightGrams || 0) / 1000),
      receiverCityId: form.receiverCityId || null,
      receiverStateId: form.receiverStateId || null,
      receiverCityName: form.receiverCity || form.destLabel || null,
      receiverStateName: form.receiverState || null,
    });
  }, [
    matrix,
    form.rateSectionId,
    form.weightGrams,
    form.receiverCityId,
    form.receiverStateId,
    form.receiverCity,
    form.receiverState,
    form.destLabel,
  ]);

  // If the typed price matches the slab rate again, treat as Auto
  useEffect(() => {
    if (!priceManual) return;
    if (Number(form.freight) === Number(resolvedPrice.amount)) {
      setPriceManual(false);
    }
  }, [priceManual, form.freight, resolvedPrice.amount]);

  // Keep freight in sync with slab pricing while in Auto mode
  useEffect(() => {
    const nextAuto = Number(resolvedPrice.amount);
    const nextColumnId = resolvedPrice.columnId || '';
    if (priceManual) {
      setForm((p) =>
        p.rateColumnId === nextColumnId
          ? p
          : { ...p, rateColumnId: nextColumnId },
      );
      return;
    }
    setForm((p) => {
      if (p.freight === nextAuto && p.rateColumnId === nextColumnId) return p;
      return {
        ...p,
        freight: nextAuto,
        rateColumnId: nextColumnId,
      };
    });
  }, [resolvedPrice.amount, resolvedPrice.columnId, priceManual]);

  const isPriceAuto =
    !priceManual || Number(form.freight) === Number(resolvedPrice.amount);

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
      (centersQuery.data ?? []).map((d) => ({
        value: d.cityId,
        label: d.label,
        subLabel: d.stateName || undefined,
      })),
    [centersQuery.data],
  );

  const courierCompanyOptions: SearchSelectOption[] = useMemo(
    () =>
      (courierCompaniesQuery.data?.data ?? []).map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [courierCompaniesQuery.data],
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
    setForm((p) => ({
      ...p,
      receiverId: opt.value,
      receiverName: r?.name || opt.label,
      receiverPhone: r?.phone || p.receiverPhone,
      receiverAddress: r?.address || p.receiverAddress,
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
    const d = (centersQuery.data ?? []).find((x) => x.cityId === opt.value);
    setForm((p) => ({
      ...p,
      destLabel: opt.label,
      receiverCityId: opt.value,
      receiverStateId: d?.stateId || '',
      receiverCity: d?.label || opt.label,
      receiverState: d?.stateName || '',
    }));
  };

  const applyCourierCompany = (opt: SearchSelectOption | null) => {
    if (!opt) {
      setForm((p) => ({
        ...p,
        courierCompanyId: '',
        courierCompanyLabel: p.courierCompanyLabel,
      }));
      return;
    }
    setForm((p) => ({
      ...p,
      courierCompanyId: opt.value,
      courierCompanyLabel: opt.label,
    }));
  };

  const buildPayload = async () => {
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
      throw new Error('Select a destination from Centers');
    }
    if (!cleaned.rateSectionId) {
      throw new Error('Select a service type');
    }
    if (!cleaned.courierCompanyId) {
      throw new Error('Select a courier company');
    }
    if (!cleaned.documentNumber?.trim()) {
      throw new Error('Document number is required');
    }

    const weightKg = Math.max(0, Number(cleaned.weightGrams || 0) / 1000);
    const freight = Number(cleaned.freight);

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
        [c?.address, c?.city, c?.state, c?.pincode].filter(Boolean).join(', ') ||
        senderAddress;
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

    const charges = [
      {
        type: ChargeType.FREIGHT,
        amount: freight,
        description: 'Freight',
      },
    ];
    if (Number(cleaned.cgst) > 0) {
      charges.push({
        type: ChargeType.CGST,
        amount: Number(cleaned.cgst),
        description: 'CGST',
      });
    }
    if (Number(cleaned.sgst) > 0) {
      charges.push({
        type: ChargeType.SGST,
        amount: Number(cleaned.sgst),
        description: 'SGST',
      });
    }
    if (Number(cleaned.igst) > 0) {
      charges.push({
        type: ChargeType.IGST,
        amount: Number(cleaned.igst),
        description: 'IGST',
      });
    }

    return {
      cleaned,
      payload: {
        bookingType: cleaned.bookingType,
        bookingDate: cleaned.bookingDate || todayIso(),
        awb: cleaned.documentNumber.trim(),
        customerId:
          cleaned.bookingType === BookingType.ACCOUNT
            ? cleaned.customerId || undefined
            : undefined,
        courierCompanyId: cleaned.courierCompanyId || undefined,
        quotationId: cleaned.quotationId || undefined,
        senderLocationId,
        receiverId: receiver.id,
        rateSectionId: cleaned.rateSectionId || undefined,
        rateColumnId: resolvedPrice.columnId || cleaned.rateColumnId || undefined,
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
        receiverCityId: cleaned.receiverCityId || undefined,
        receiverStateId: cleaned.receiverStateId || undefined,
        weightKg,
        cgst: Number(cleaned.cgst) || 0,
        sgst: Number(cleaned.sgst) || 0,
        igst: Number(cleaned.igst) || 0,
        serviceType: ServiceType.STANDARD,
        remarks: cleaned.remarks || undefined,
        charges,
      },
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { cleaned, payload } = await buildPayload();
      if (editingId) {
        await api.patch(`/consignments/${editingId}`, payload, {
          toastSummary: 'Success',
          toastDetail: `Booking ${editingAwb || ''} updated successfully.`.trim(),
        });
        return;
      }
      await api.post('/consignments', payload, {
        toastSummary: 'Success',
        toastDetail:
          cleaned.bookingType === BookingType.ACCOUNT
            ? 'Account booking created successfully.'
            : 'Cash booking created successfully.',
      });
    },
    onSuccess: async () => {
      resetForm();
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
              ?.response?.data?.error?.message || 'Failed to save booking';
      setError(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/consignments/${id}`);
    },
    onSuccess: async (_data, id) => {
      if (editingId === id) resetForm();
      await qc.invalidateQueries({ queryKey: ['consignments-recent'] });
      await qc.invalidateQueries({ queryKey: ['consignments'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
    },
  });

  const loadForEdit = async (row: ConsignmentRow) => {
    setError('');
    try {
      const res = await api.get(`/consignments/${row.id}`);
      const detail = unwrap<ConsignmentDetail>(res.data);
      if (detail.bookingType && detail.bookingType !== mode) {
        router.replace(`/bookings?type=${detail.bookingType}`);
      }

      const freightCharge = (detail.charges ?? []).find(
        (c) => c.type === ChargeType.FREIGHT,
      );
      const freight = Number(freightCharge?.amount ?? 0);
      const weightGrams = Math.round(Number(detail.weightKg ?? 0) * 1000) || 100;

      setEditingId(detail.id);
      setEditingAwb(detail.awb);
      setPriceManual(true);
      setForm({
        ...emptyForm,
        bookingType: detail.bookingType || mode,
        bookingDate: (detail.bookingDate || todayIso()).slice(0, 10),
        documentNumber: detail.awb || '',
        customerId: detail.customerId || detail.customer?.id || '',
        customerLabel: detail.customer?.name || '',
        courierCompanyId:
          detail.courierCompanyId || detail.courierCompany?.id || '',
        courierCompanyLabel: detail.courierCompany?.name || '',
        quotationId: detail.quotationId || '',
        senderLocationId: detail.senderLocationId || '',
        receiverId: detail.receiverId || '',
        rateSectionId: detail.rateSectionId || '',
        rateSectionLabel: detail.rateSectionId
          ? serviceTypeLabel(detail.rateSectionId)
          : '',
        rateColumnId: detail.rateColumnId || '',
        partyName: detail.partyName || '',
        partyPhone: detail.partyPhone || '',
        partyAddress: detail.partyAddress || '',
        partyCity: detail.partyCity || '',
        partyState: detail.partyState || '',
        partyPincode: detail.partyPincode || '',
        partyGstin: detail.partyGstin || '',
        partyEmail: detail.partyEmail || '',
        senderName: detail.senderName || '',
        senderPhone: detail.senderPhone || '',
        senderAddress: detail.senderAddress || '',
        receiverName: detail.receiverName || '',
        receiverPhone: detail.receiverPhone || '',
        receiverAddress: detail.receiverAddress || '',
        receiverCity: detail.receiverCity || '',
        receiverState: detail.receiverState || '',
        receiverCityId: detail.receiverCityId || '',
        receiverStateId: detail.receiverStateId || '',
        destLabel: detail.receiverCity || '',
        weightGrams,
        freight,
        cgst: Number(detail.cgst ?? 0),
        sgst: Number(detail.sgst ?? 0),
        igst: Number(detail.igst ?? 0),
        remarks: detail.remarks || '',
      });

      if (detail.bookingType === BookingType.CASH && cashRatesQuery.data) {
        setRateSource(cashRatesQuery.data);
        setRateHint('Rates from your cash template');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Failed to load booking for edit');
    }
  };

  const askDelete = (row: ConsignmentRow) => {
    confirmDialog({
      header: 'Delete booking',
      message: `Delete booking ${row.awb}? It will be hidden from lists (soft delete).`,
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => deleteMutation.mutate(row.id),
    });
  };

  return (
    <div>
      <ConfirmDialog />
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
            {editingId
              ? `Edit booking ${editingAwb}`
              : mode === BookingType.ACCOUNT
                ? 'New account booking'
                : 'New cash booking'}
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Type to search — Tab or Enter selects the first result.
          </p>

          <div className="form-grid">
            <div className="field">
              <label>Booking Date</label>
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
            )}

            <div className="field">
              <label>Courier company</label>
              <SearchSelect
                value={form.courierCompanyLabel}
                options={courierCompanyOptions}
                placeholder="Type courier company…"
                allowFreeText={false}
                emptyHint="No active courier companies"
                onChange={(text) =>
                  setForm((p) => ({
                    ...p,
                    courierCompanyLabel: text,
                    courierCompanyId: '',
                  }))
                }
                onSelect={applyCourierCompany}
              />
            </div>

            <div className="field">
              <label>Document Number</label>
              <InputText
                value={form.documentNumber}
                onChange={(e) =>
                  setForm((p) => ({ ...p, documentNumber: e.target.value }))
                }
                placeholder="Enter document number"
                style={{ width: '100%' }}
              />
            </div>

            <div className="field">
              <label>Destination</label>
              <SearchSelect
                value={form.destLabel}
                options={destOptions}
                placeholder="Type destination from Centers…"
                allowFreeText={false}
                emptyHint="Configure Centers first"
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

            {mode === BookingType.CASH ? (
              <>
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
            ) : null}

            <div className="field">
              <label>Receiver Name</label>
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
              <label>Receiver Phone</label>
              <InputText
                value={form.receiverPhone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, receiverPhone: e.target.value }))
                }
                style={{ width: '100%' }}
              />
            </div>
            <div className="field full">
              <label>Receiver Address</label>
              <InputText
                value={form.receiverAddress}
                onChange={(e) =>
                  setForm((p) => ({ ...p, receiverAddress: e.target.value }))
                }
                style={{ width: '100%' }}
              />
            </div>

            <div className="field">
              <label>Service Type</label>
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
                    weightGrams: p.weightGrams > 0 ? p.weightGrams : 100,
                  }));
                }}
              />
            </div>

            <div className="field">
              <label>Weight (g)</label>
              <InputNumber
                value={form.weightGrams}
                onValueChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    weightGrams: Math.max(Number(e.value ?? 0), 0),
                  }))
                }
                min={0}
                minFractionDigits={0}
                maxFractionDigits={0}
                useGrouping={false}
                style={{ width: '100%' }}
                inputStyle={{ width: '100%' }}
              />
            </div>

            <div className="field">
              <label>{isPriceAuto ? 'Price (Auto)' : 'Price (Manual)'}</label>
              <InputNumber
                value={form.freight}
                onValueChange={(e) => {
                  const next = Math.max(Number(e.value ?? 0), 0);
                  const auto = Number(resolvedPrice.amount);
                  setPriceManual(next !== auto);
                  setForm((p) => ({ ...p, freight: next }));
                }}
                min={0}
                minFractionDigits={0}
                maxFractionDigits={2}
                style={{ width: '100%' }}
                inputStyle={{ width: '100%' }}
              />
            </div>

            <div className="field">
              <label>CGST</label>
              <InputNumber
                value={form.cgst}
                onValueChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    cgst: Math.max(Number(e.value ?? 0), 0),
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
              <label>SGST</label>
              <InputNumber
                value={form.sgst}
                onValueChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    sgst: Math.max(Number(e.value ?? 0), 0),
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
              <label>IGST</label>
              <InputNumber
                value={form.igst}
                onValueChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    igst: Math.max(Number(e.value ?? 0), 0),
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
          {form.rateSectionId &&
          form.receiverCityId &&
          matrix &&
          resolvedPrice.amount === 0 ? (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              No rate found for this destination / service type / weight on the
              quotation (tried city → state → ROI). Check the rate matrix cells
              are filled for that weight band.
            </p>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}

          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <Button
              label={editingId ? 'Update booking' : 'Create booking'}
              icon="pi pi-check"
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            />
            {editingId ? (
              <Button
                label="Cancel edit"
                severity="secondary"
                outlined
                onClick={() => resetForm()}
              />
            ) : null}
          </div>
        </div>

        <aside className="bookings-split-recent panel">
          <h2>Recent {BOOKING_TYPE_LABELS[mode].toLowerCase()}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Last {recentQuery.data?.data?.length ?? 0} of yours
          </p>
          <div className="booking-recent-list">
            {(recentQuery.data?.data ?? []).map((row) => (
              <div key={row.id} className="booking-recent-card">
                <div className="booking-recent-awb">
                  <Link href={`/tracking?awb=${encodeURIComponent(row.awb)}`}>
                    {row.awb}
                  </Link>
                </div>
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
                <div
                  style={{
                    display: 'flex',
                    gap: '0.35rem',
                    marginTop: '0.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    size="small"
                    text
                    icon="pi pi-pencil"
                    label="Edit"
                    onClick={() => loadForEdit(row)}
                  />
                  <Button
                    size="small"
                    text
                    severity="danger"
                    icon="pi pi-trash"
                    label="Delete"
                    loading={deleteMutation.isPending}
                    onClick={() => askDelete(row)}
                  />
                </div>
              </div>
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
