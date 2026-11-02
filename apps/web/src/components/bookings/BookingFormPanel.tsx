'use client';

import { BookingType, ChargeType, ServiceType } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  InputNumber,
  InputText,
  SearchSelect,
  Textarea,
  type SearchSelectOption,
} from '@/components/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, unwrap } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchPaginated } from '@/lib/list';
import {
  resolveRate,
  serviceTypeLabel,
  toMatrixForm,
  weightLabelForGrams,
} from '@/lib/quotations';
import {
  bookingActionTabIndex,
  bookingFieldTabIndex,
  type BookingTabConfig,
} from '@/lib/booking-tab-config';
import { trimFormData } from '@/lib/trim';

type RememberFlags = {
  customer: boolean;
  destination: boolean;
  receiver: boolean;
  courierCompany: boolean;
  serviceType: boolean;
  weight: boolean;
};

type RememberedValues = Partial<{
  customerId: string;
  customerLabel: string;
  quotationId: string;
  senderLocationId: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  partyName: string;
  partyPhone: string;
  partyAddress: string;
  partyCity: string;
  partyState: string;
  partyPincode: string;
  partyGstin: string;
  partyEmail: string;
  destLabel: string;
  receiverCityId: string;
  receiverStateId: string;
  receiverCity: string;
  receiverState: string;
  receiverId: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  courierCompanyId: string;
  courierCompanyLabel: string;
  rateSectionId: string;
  rateSectionLabel: string;
  rateColumnId: string;
  weightGrams: number;
}>;

const DEFAULT_REMEMBER_FLAGS: RememberFlags = {
  customer: false,
  destination: false,
  receiver: false,
  courierCompany: false,
  serviceType: false,
  weight: false,
};

function rememberStorageKey(userId: string, mode: BookingType) {
  return `booking-remember:${userId}:${mode}`;
}

function loadRememberState(userId: string, mode: BookingType): {
  flags: RememberFlags;
  values: RememberedValues;
} {
  if (typeof window === 'undefined') {
    return { flags: { ...DEFAULT_REMEMBER_FLAGS }, values: {} };
  }
  try {
    const raw = window.localStorage.getItem(rememberStorageKey(userId, mode));
    if (!raw) return { flags: { ...DEFAULT_REMEMBER_FLAGS }, values: {} };
    const parsed = JSON.parse(raw) as {
      flags?: Partial<RememberFlags>;
      values?: RememberedValues;
    };
    return {
      flags: { ...DEFAULT_REMEMBER_FLAGS, ...(parsed.flags ?? {}) },
      values: parsed.values ?? {},
    };
  } catch {
    return { flags: { ...DEFAULT_REMEMBER_FLAGS }, values: {} };
  }
}

function saveRememberState(
  userId: string,
  mode: BookingType,
  flags: RememberFlags,
  values: RememberedValues,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    rememberStorageKey(userId, mode),
    JSON.stringify({ flags, values }),
  );
}

type BookingFormState = {
  bookingType: BookingType;
  bookingDate: string;
  customerId: string;
  customerLabel: string;
  courierCompanyId: string;
  courierCompanyLabel: string;
  quotationId: string;
  senderLocationId: string;
  receiverId: string;
  rateSectionId: string;
  rateSectionLabel: string;
  rateColumnId: string;
  partyName: string;
  partyPhone: string;
  partyAddress: string;
  partyCity: string;
  partyState: string;
  partyPincode: string;
  partyGstin: string;
  partyEmail: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverCity: string;
  receiverState: string;
  receiverCityId: string;
  receiverStateId: string;
  destLabel: string;
  documentNumber: string;
  weightGrams: number;
  freight: number;
  cgst: number;
  sgst: number;
  igst: number;
  remarks: string;
};

function snapshotRememberedValues(
  flags: RememberFlags,
  form: BookingFormState,
): RememberedValues {
  const values: RememberedValues = {};
  if (flags.customer) {
    values.customerId = form.customerId;
    values.customerLabel = form.customerLabel;
    values.quotationId = form.quotationId;
    values.senderLocationId = form.senderLocationId;
    values.senderName = form.senderName;
    values.senderPhone = form.senderPhone;
    values.senderAddress = form.senderAddress;
    values.partyName = form.partyName;
    values.partyPhone = form.partyPhone;
    values.partyAddress = form.partyAddress;
    values.partyCity = form.partyCity;
    values.partyState = form.partyState;
    values.partyPincode = form.partyPincode;
    values.partyGstin = form.partyGstin;
    values.partyEmail = form.partyEmail;
  }
  if (flags.destination) {
    values.destLabel = form.destLabel;
    values.receiverCityId = form.receiverCityId;
    values.receiverStateId = form.receiverStateId;
    values.receiverCity = form.receiverCity;
    values.receiverState = form.receiverState;
  }
  if (flags.receiver) {
    values.receiverId = form.receiverId;
    values.receiverName = form.receiverName;
    values.receiverPhone = form.receiverPhone;
    values.receiverAddress = form.receiverAddress;
  }
  if (flags.courierCompany) {
    values.courierCompanyId = form.courierCompanyId;
    values.courierCompanyLabel = form.courierCompanyLabel;
  }
  if (flags.serviceType) {
    values.rateSectionId = form.rateSectionId;
    values.rateSectionLabel = form.rateSectionLabel;
    values.rateColumnId = form.rateColumnId;
  }
  if (flags.weight) {
    values.weightGrams = form.weightGrams;
  }
  return values;
}

function applyRememberedValues(
  base: BookingFormState,
  flags: RememberFlags,
  values: RememberedValues,
): BookingFormState {
  let next = { ...base };
  if (flags.customer) {
    next = {
      ...next,
      customerId: values.customerId || '',
      customerLabel: values.customerLabel || '',
      quotationId: values.quotationId || '',
      senderLocationId: values.senderLocationId || '',
      senderName: values.senderName || '',
      senderPhone: values.senderPhone || '',
      senderAddress: values.senderAddress || '',
      partyName: values.partyName || '',
      partyPhone: values.partyPhone || '',
      partyAddress: values.partyAddress || '',
      partyCity: values.partyCity || '',
      partyState: values.partyState || '',
      partyPincode: values.partyPincode || '',
      partyGstin: values.partyGstin || '',
      partyEmail: values.partyEmail || '',
    };
  }
  if (flags.destination) {
    next = {
      ...next,
      destLabel: values.destLabel || '',
      receiverCityId: values.receiverCityId || '',
      receiverStateId: values.receiverStateId || '',
      receiverCity: values.receiverCity || '',
      receiverState: values.receiverState || '',
    };
  }
  if (flags.receiver) {
    next = {
      ...next,
      receiverId: values.receiverId || '',
      receiverName: values.receiverName || '',
      receiverPhone: values.receiverPhone || '',
      receiverAddress: values.receiverAddress || '',
    };
  }
  if (flags.courierCompany) {
    next = {
      ...next,
      courierCompanyId: values.courierCompanyId || '',
      courierCompanyLabel: values.courierCompanyLabel || '',
    };
  }
  if (flags.serviceType) {
    next = {
      ...next,
      rateSectionId: values.rateSectionId || '',
      rateSectionLabel: values.rateSectionLabel || '',
      rateColumnId: values.rateColumnId || '',
    };
  }
  if (flags.weight) {
    next = {
      ...next,
      weightGrams: values.weightGrams || 100,
    };
  }
  return next;
}

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

export type BookingFormPanelProps = {
  mode: BookingType;
  editingId?: string | null;
  variant?: 'page' | 'dialog';
  showRemember?: boolean;
  onCancel?: () => void;
  onSaved?: (info: { created: boolean }) => void;
  onEditingChange?: (id: string | null) => void;
};

export function BookingFormPanel({
  mode,
  editingId: editingIdProp = null,
  variant = 'page',
  showRemember = true,
  onCancel,
  onSaved,
  onEditingChange,
}: BookingFormPanelProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || 'anon';
  const isDialog = variant === 'dialog';
  const tabConfig = user?.userInfo?.bookingTabConfig as
    | BookingTabConfig
    | null
    | undefined;
  const ti = (fieldKey: string) =>
    bookingFieldTabIndex(fieldKey, mode, tabConfig);
  const actionTi = bookingActionTabIndex(mode, tabConfig);

  const [form, setForm] = useState({ ...emptyForm, bookingType: mode });
  const [error, setError] = useState('');
  const [rateSource, setRateSource] = useState<RateSource | null>(null);
  const [rateHint, setRateHint] = useState('');
  /** false = follow slab auto price; true = user override */
  const [priceManual, setPriceManual] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAwb, setEditingAwb] = useState('');
  const [rememberFlags, setRememberFlags] = useState<RememberFlags>({
    ...DEFAULT_REMEMBER_FLAGS,
  });
  const [rememberedValues, setRememberedValues] = useState<RememberedValues>(
    {},
  );
  /** Bumped on reset so rates reload even when customerId is unchanged (multi-entry). */
  const [ratesNonce, setRatesNonce] = useState(0);
  const customerFocusRef = useRef<HTMLInputElement>(null);
  const partyFocusRef = useRef<HTMLInputElement>(null);
  const focusStartField = () => {
    window.setTimeout(() => {
      const el =
        mode === BookingType.ACCOUNT
          ? customerFocusRef.current
          : partyFocusRef.current;
      el?.focus();
      if (!isDialog) {
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

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

  const resetForm = (opts?: {
    focusStart?: boolean;
    rememberedOverride?: RememberedValues;
  }) => {
    const remembered = opts?.rememberedOverride ?? rememberedValues;
    let next: BookingFormState = {
      ...emptyForm,
      bookingType: mode,
      bookingDate: todayIso(),
      courierCompanyId: defaultCourierCompany.courierCompanyId,
      courierCompanyLabel: defaultCourierCompany.courierCompanyLabel,
    };
    next = applyRememberedValues(next, rememberFlags, remembered);
    if (!rememberFlags.courierCompany || !remembered.courierCompanyId) {
      next.courierCompanyId = defaultCourierCompany.courierCompanyId;
      next.courierCompanyLabel = defaultCourierCompany.courierCompanyLabel;
    }
    setForm(next);
    setRateSource(null);
    setRateHint('');
    setRatesNonce((n) => n + 1);
    setError('');
    setPriceManual(false);
    setEditingId(null);
    setEditingAwb('');
    if (opts?.focusStart) focusStartField();
  };

  const updateRememberFlag = (key: keyof RememberFlags, checked: boolean) => {
    setRememberFlags((prev) => {
      const nextFlags = { ...prev, [key]: checked };
      const nextValues = checked
        ? {
            ...rememberedValues,
            ...snapshotRememberedValues(
              { ...DEFAULT_REMEMBER_FLAGS, [key]: true },
              form,
            ),
          }
        : rememberedValues;
      if (!checked) {
        // keep old values in storage until next save; only flags matter for apply
      }
      setRememberedValues(nextValues);
      saveRememberState(userId, mode, nextFlags, nextValues);
      return nextFlags;
    });
  };

  useEffect(() => {
    // Skip hydrate while editing (page or dialog)
    if (editingIdProp || editingId) return;

    const stored = loadRememberState(userId, mode);
    setRememberFlags(stored.flags);
    setRememberedValues(stored.values);

    let next: BookingFormState = {
      ...emptyForm,
      bookingType: mode,
      bookingDate: todayIso(),
      courierCompanyId: defaultCourierCompany.courierCompanyId,
      courierCompanyLabel: defaultCourierCompany.courierCompanyLabel,
    };
    next = applyRememberedValues(next, stored.flags, stored.values);
    if (!stored.flags.courierCompany || !stored.values.courierCompanyId) {
      next.courierCompanyId = defaultCourierCompany.courierCompanyId;
      next.courierCompanyLabel = defaultCourierCompany.courierCompanyLabel;
    }
    setForm(next);
    setRateSource(null);
    setRateHint('');
    setRatesNonce((n) => n + 1);
    setError('');
    setPriceManual(false);
    setEditingId(null);
    setEditingAwb('');
    focusStartField();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate remember + reset when mode/user changes
  }, [userId, mode]);

  useEffect(() => {
    if (editingId) return;
    if (!defaultCourierCompany.courierCompanyId) return;
    if (rememberFlags.courierCompany && rememberedValues.courierCompanyId) {
      return;
    }
    setForm((p) => {
      if (p.courierCompanyId) return p;
      return {
        ...p,
        courierCompanyId: defaultCourierCompany.courierCompanyId,
        courierCompanyLabel: defaultCourierCompany.courierCompanyLabel,
      };
    });
  }, [
    defaultCourierCompany,
    editingId,
    rememberFlags.courierCompany,
    rememberedValues.courierCompanyId,
  ]);

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
  }, [mode, form.customerId, cashRatesQuery.data, ratesNonce]);

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

  // After rates load, re-bind remembered Service type id/label to matrix sections
  useEffect(() => {
    if (editingId) return;
    if (!rememberFlags.serviceType) return;
    if (!sectionOptions.length) return;

    const wantedId =
      form.rateSectionId || rememberedValues.rateSectionId || '';
    const wantedLabel =
      form.rateSectionLabel || rememberedValues.rateSectionLabel || '';

    const byId = wantedId
      ? sectionOptions.find((o) => o.value === wantedId)
      : undefined;
    const byLabel = wantedLabel
      ? sectionOptions.find(
          (o) =>
            o.label.trim().toLowerCase() === wantedLabel.trim().toLowerCase(),
        )
      : undefined;
    const match = byId || byLabel;
    if (!match) return;
    if (
      form.rateSectionId === match.value &&
      form.rateSectionLabel === match.label
    ) {
      return;
    }
    setForm((p) => ({
      ...p,
      rateSectionId: match.value,
      rateSectionLabel: match.label,
    }));
  }, [
    editingId,
    rememberFlags.serviceType,
    sectionOptions,
    form.rateSectionId,
    form.rateSectionLabel,
    rememberedValues.rateSectionId,
    rememberedValues.rateSectionLabel,
  ]);

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
        // Keep service type when "Remember → Service type" is on
        ...(rememberFlags.serviceType
          ? {}
          : { rateSectionId: '', rateSectionLabel: '' }),
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
      // Changing customer used to wipe Service type — preserve when remembered
      ...(rememberFlags.serviceType
        ? {}
        : { rateSectionId: '', rateSectionLabel: '' }),
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
        cgst:
          cleaned.bookingType === BookingType.ACCOUNT
            ? 0
            : Number(cleaned.cgst) || 0,
        sgst:
          cleaned.bookingType === BookingType.ACCOUNT
            ? 0
            : Number(cleaned.sgst) || 0,
        igst:
          cleaned.bookingType === BookingType.ACCOUNT
            ? 0
            : Number(cleaned.igst) || 0,
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
        return { created: false as const };
      }
      await api.post('/consignments', payload, {
        toastSummary: 'Success',
        toastDetail:
          cleaned.bookingType === BookingType.ACCOUNT
            ? 'Account booking created successfully.'
            : 'Cash booking created successfully.',
      });
      return { created: true as const };
    },
    onSuccess: async (result) => {
      if (result?.created) {
        const nextValues = {
          ...rememberedValues,
          ...snapshotRememberedValues(rememberFlags, form),
        };
        setRememberedValues(nextValues);
        saveRememberState(userId, mode, rememberFlags, nextValues);
        resetForm({ focusStart: !isDialog, rememberedOverride: nextValues });
        onEditingChange?.(null);
        onSaved?.({ created: true });
      } else {
        resetForm({ focusStart: false });
        onEditingChange?.(null);
        onSaved?.({ created: false });
      }
      await qc.invalidateQueries({ queryKey: ['consignments-recent'] });
      await qc.invalidateQueries({ queryKey: ['consignments'] });
      await qc.invalidateQueries({ queryKey: ['receivers'] });
      await qc.invalidateQueries({ queryKey: ['receivers-booking'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
      await qc.invalidateQueries({ queryKey: ['booking-list'] });
      await qc.invalidateQueries({ queryKey: ['booking-detail'] });
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

  const loadForEdit = async (row: Pick<ConsignmentRow, 'id'>) => {
    setError('');
    try {
      const res = await api.get(`/consignments/${row.id}`);
      const detail = unwrap<ConsignmentDetail>(res.data);
      const nextType = detail.bookingType || mode;

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
        bookingType: nextType,
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

      if (nextType === BookingType.CASH && cashRatesQuery.data) {
        setRateSource(cashRatesQuery.data);
        setRateHint('Rates from your cash template');
      } else {
        setRatesNonce((n) => n + 1);
      }
      onEditingChange?.(detail.id);
      if (!isDialog) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return true;
    } catch {
      setError('Failed to load booking for edit');
      return false;
    }
  };

  useEffect(() => {
    if (!editingIdProp) return;
    if (editingIdProp === editingId) return;
    void loadForEdit({ id: editingIdProp });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when parent requests edit
  }, [editingIdProp]);

  return (
    <div className={isDialog ? undefined : 'bookings-split-form panel'}>
      {!isDialog ? (
        <>
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
        </>
      ) : null}

          <div className="form-grid">
            <div className="field">
              <label>Booking Date</label>
              <InputText
                type="date"
                value={form.bookingDate}
                tabIndex={ti('bookingDate')}
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
                  inputRef={customerFocusRef}
                  value={form.customerLabel}
                  options={customerOptions}
                  placeholder="Type customer name…"
                  allowFreeText={false}
                  emptyHint="No customers match"
                  tabIndex={ti('customer')}
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
                  ref={partyFocusRef}
                  value={form.partyName}
                  tabIndex={ti('partyName')}
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
                tabIndex={ti('courierCompany')}
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
                tabIndex={ti('documentNumber')}
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
                tabIndex={ti('destination')}
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
                    tabIndex={ti('partyPhone')}
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
                    tabIndex={ti('partyAddress')}
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
                    tabIndex={ti('partyCity')}
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
                    tabIndex={ti('partyGstin')}
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
                tabIndex={ti('receiverName')}
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
                tabIndex={ti('receiverPhone')}
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
                tabIndex={ti('receiverAddress')}
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
                tabIndex={ti('serviceType')}
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
                tabIndex={ti('weight')}
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
                tabIndex={ti('price')}
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

            {mode === BookingType.CASH ? (
              <>
                <div className="field">
                  <label>CGST</label>
                  <InputNumber
                    value={form.cgst}
                    tabIndex={ti('cgst')}
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
                    tabIndex={ti('sgst')}
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
                    tabIndex={ti('igst')}
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
              </>
            ) : null}

            <div className="field full">
              <label>Remarks</label>
              <Textarea
                value={form.remarks}
                tabIndex={ti('remarks')}
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
              tabIndex={actionTi}
              onClick={() => saveMutation.mutate()}
            />
            {editingId ? (
              <Button
                label="Cancel edit"
                severity="secondary"
                outlined
                tabIndex={actionTi + 1}
                onClick={() => {
                resetForm();
                onEditingChange?.(null);
                onCancel?.();
              }}
              />
            ) : null}
          </div>

          {showRemember && !editingId ? (
            <div
              className="booking-remember"
              style={{
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--surface-border, #e5e7eb)',
              }}
            >
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
                Remember for next booking
              </p>
              <p className="muted" style={{ margin: '0 0 0.75rem' }}>
                Checked fields stay filled after Create booking. Focus returns to{' '}
                {mode === BookingType.ACCOUNT ? 'Customer' : 'Party name'}.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem 1.25rem',
                }}
              >
                {(
                  [
                    {
                      key: 'customer' as const,
                      label:
                        mode === BookingType.ACCOUNT
                          ? 'Customer'
                          : 'Party details',
                    },
                    { key: 'destination' as const, label: 'Destination' },
                    { key: 'receiver' as const, label: 'Receiver' },
                    {
                      key: 'courierCompany' as const,
                      label: 'Courier company',
                    },
                    { key: 'serviceType' as const, label: 'Service type' },
                    { key: 'weight' as const, label: 'Weight' },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.key}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      tabIndex={-1}
                      checked={rememberFlags[opt.key]}
                      onChange={(e) =>
                        updateRememberFlag(opt.key, e.target.checked)
                      }
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
    </div>
  );
}
