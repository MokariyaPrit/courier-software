'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DataTable,
  Dialog,
  InputNumber,
  InputText,
  Select,
  Tag,
  Textarea,
  ToggleSwitch,
} from '@/components/ui';
import { Dispatch, SetStateAction, useState } from 'react';
import { ListFilterChrome } from '@/components/ListControls';
import { PasswordInput } from '@/components/PasswordInput';
import { api, unwrap } from '@/lib/api';
import {
  FieldErrors,
  firstError,
  validateEmail,
  validateFullName,
  validatePassword,
} from '@/lib/form-validation';
import { fetchPaginated, SortOption, useListParams } from '@/lib/list';
import {
  TERM_PLACEHOLDER_HELP,
  editorTextToTerms,
  termsToEditorText,
} from '@/lib/terms-and-conditions';
import { trimFormData } from '@/lib/trim';

const USER_SORT_OPTIONS: SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'DESC', isDefault: true },
  { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { label: 'Name Asc', sortBy: 'fullName', sortOrder: 'ASC' },
  { label: 'Name Desc', sortBy: 'fullName', sortOrder: 'DESC' },
  { label: 'Email Asc', sortBy: 'email', sortOrder: 'ASC' },
  { label: 'Email Desc', sortBy: 'email', sortOrder: 'DESC' },
  { label: 'Role Asc', sortBy: 'role', sortOrder: 'ASC' },
  { label: 'Expired on Asc', sortBy: 'expiredOn', sortOrder: 'ASC' },
  { label: 'Expired on Desc', sortBy: 'expiredOn', sortOrder: 'DESC' },
];

interface UserInfoFields {
  fullName: string;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  gstin: string | null;
  panNumber: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  sgstPercent: string | number | null;
  cgstPercent: string | number | null;
  igstPercent: string | number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  notes: string | null;
  termsAndConditions?: string[] | null;
  insurancePercent?: string | number | null;
  paymentDays?: number | null;
  volumetricDivisor?: number | null;
  ewayBillThreshold?: string | number | null;
  expiredOn?: string | null;
}

interface UserRow {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  userInfo?: UserInfoFields | null;
}

interface UserFormState {
  fullName: string;
  email: string;
  password: string;
  userRole: Role;
  phone: string;
  companyName: string;
  gstin: string;
  panNumber: string;
  bankName: string;
  bankAccountNo: string;
  bankIfsc: string;
  upiId: string;
  sgstPercent: number;
  cgstPercent: number;
  igstPercent: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  insurancePercent: number;
  paymentDays: number;
  volumetricDivisor: number;
  ewayBillThreshold: number;
  termsText: string;
  expiredOn: string;
  isActive: boolean;
}

type UserFieldKey = 'fullName' | 'email' | 'password';

const EMPTY_USER_FORM: UserFormState = {
  fullName: '',
  email: '',
  password: '',
  userRole: Role.BRANCH_MANAGER,
  phone: '',
  companyName: '',
  gstin: '',
  panNumber: '',
  bankName: '',
  bankAccountNo: '',
  bankIfsc: '',
  upiId: '',
  sgstPercent: 9,
  cgstPercent: 9,
  igstPercent: 0,
  address: '',
  city: '',
  state: '',
  pincode: '',
  notes: '',
  insurancePercent: 2,
  paymentDays: 10,
  volumetricDivisor: 5000,
  ewayBillThreshold: 50000,
  termsText: termsToEditorText(null),
  expiredOn: '',
  isActive: true,
};

function formatExpiredOn(value: string | null | undefined) {
  if (!value) return '—';
  const key = String(value).slice(0, 10);
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('en-IN');
}

function isExpiredPast(value: string | null | undefined) {
  if (!value) return false;
  const key = String(value).slice(0, 10);
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` > key;
}

const ROLE_OPTIONS = [
  { label: 'Admin', value: Role.ADMIN },
  { label: 'Branch Manager', value: Role.BRANCH_MANAGER },
];

function toFormFromUser(user: UserRow): UserFormState {
  return {
    fullName: user.userInfo?.fullName || '',
    email: user.email || '',
    password: '',
    userRole: user.role,
    phone: user.userInfo?.phone || '',
    companyName: user.userInfo?.companyName || '',
    gstin: user.userInfo?.gstin || '',
    panNumber: user.userInfo?.panNumber || '',
    bankName: user.userInfo?.bankName || '',
    bankAccountNo: user.userInfo?.bankAccountNo || '',
    bankIfsc: user.userInfo?.bankIfsc || '',
    upiId: user.userInfo?.upiId || '',
    sgstPercent: Number(user.userInfo?.sgstPercent ?? 9),
    cgstPercent: Number(user.userInfo?.cgstPercent ?? 9),
    igstPercent: Number(user.userInfo?.igstPercent ?? 0),
    address: user.userInfo?.address || '',
    city: user.userInfo?.city || '',
    state: user.userInfo?.state || '',
    pincode: user.userInfo?.pincode || '',
    notes: user.userInfo?.notes || '',
    insurancePercent: Number(user.userInfo?.insurancePercent ?? 2),
    paymentDays: Number(user.userInfo?.paymentDays ?? 10),
    volumetricDivisor: Number(user.userInfo?.volumetricDivisor ?? 5000),
    ewayBillThreshold: Number(user.userInfo?.ewayBillThreshold ?? 50000),
    termsText: termsToEditorText(user.userInfo?.termsAndConditions),
    expiredOn: user.userInfo?.expiredOn
      ? String(user.userInfo.expiredOn).slice(0, 10)
      : '',
    isActive: user.isActive,
  };
}

function validateUserForm(
  state: UserFormState,
  options?: { passwordOptional?: boolean },
): FieldErrors {
  return {
    fullName: validateFullName(state.fullName),
    email: validateEmail(state.email),
    password: validatePassword(state.password, {
      optional: options?.passwordOptional,
    }),
  };
}

function fieldClass(errors: FieldErrors, key: UserFieldKey) {
  return `field${errors[key] ? ' has-error' : ''}`;
}

function UserFormFields({
  state,
  setState,
  errors,
  setErrors,
  onBlurField,
  passwordOptional,
}: {
  state: UserFormState;
  setState: Dispatch<SetStateAction<UserFormState>>;
  errors: FieldErrors;
  setErrors: Dispatch<SetStateAction<FieldErrors>>;
  onBlurField: (key: UserFieldKey) => void;
  passwordOptional?: boolean;
}) {
  const clearOrUpdate = (key: UserFieldKey, msg: string) => {
    if (!errors[key] && !msg) return;
    setErrors((prev) => ({ ...prev, [key]: msg }));
  };

  return (
    <div className="form-grid">
      <div className={fieldClass(errors, 'fullName')}>
        <label>Full name</label>
        <InputText
          value={state.fullName}
          className={errors.fullName ? 'p-invalid' : undefined}
          onChange={(e) => {
            const value = e.target.value;
            setState((prev) => ({ ...prev, fullName: value }));
            if (errors.fullName) clearOrUpdate('fullName', validateFullName(value));
          }}
          onBlur={() => onBlurField('fullName')}
          style={{ width: '100%' }}
        />
        {errors.fullName ? (
          <small className="field-error">{errors.fullName}</small>
        ) : null}
      </div>

      <div className={fieldClass(errors, 'email')}>
        <label>Email</label>
        <InputText
          value={state.email}
          className={errors.email ? 'p-invalid' : undefined}
          onChange={(e) => {
            const value = e.target.value;
            setState((prev) => ({ ...prev, email: value }));
            if (errors.email) clearOrUpdate('email', validateEmail(value));
          }}
          onBlur={() => onBlurField('email')}
          style={{ width: '100%' }}
        />
        {errors.email ? (
          <small className="field-error">{errors.email}</small>
        ) : null}
      </div>

      <div className={fieldClass(errors, 'password')}>
        <label>
          Password
          {passwordOptional ? ' (leave blank to keep current)' : ''}
        </label>
        <PasswordInput
          value={state.password}
          invalid={Boolean(errors.password)}
          onChange={(value) => {
            setState((prev) => ({ ...prev, password: value }));
            if (errors.password) {
              clearOrUpdate(
                'password',
                validatePassword(value, { optional: passwordOptional }),
              );
            }
          }}
          onBlur={() => onBlurField('password')}
        />
        {errors.password ? (
          <small className="field-error">{errors.password}</small>
        ) : null}
      </div>

      <div className="field">
        <label>User role</label>
        <Select
          value={state.userRole}
          options={ROLE_OPTIONS}
          onChange={(e) =>
            setState((prev) => ({ ...prev, userRole: e.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>Phone</label>
        <InputText
          value={state.phone}
          onChange={(e) =>
            setState((prev) => ({ ...prev, phone: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>Company name</label>
        <InputText
          value={state.companyName}
          onChange={(e) =>
            setState((prev) => ({ ...prev, companyName: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>GSTIN</label>
        <InputText
          value={state.gstin}
          onChange={(e) =>
            setState((prev) => ({ ...prev, gstin: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>PAN number</label>
        <InputText
          value={state.panNumber}
          onChange={(e) =>
            setState((prev) => ({ ...prev, panNumber: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>Bank name</label>
        <InputText
          value={state.bankName}
          onChange={(e) =>
            setState((prev) => ({ ...prev, bankName: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>Acc. No.</label>
        <InputText
          value={state.bankAccountNo}
          onChange={(e) =>
            setState((prev) => ({ ...prev, bankAccountNo: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>IFSC code</label>
        <InputText
          value={state.bankIfsc}
          onChange={(e) =>
            setState((prev) => ({ ...prev, bankIfsc: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>UPI ID</label>
        <InputText
          value={state.upiId}
          onChange={(e) =>
            setState((prev) => ({ ...prev, upiId: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>SGST / UTGST %</label>
        <InputNumber
          value={state.sgstPercent}
          onValueChange={(e) =>
            setState((prev) => ({
              ...prev,
              sgstPercent: Number(e.value ?? 0),
            }))
          }
          min={0}
          minFractionDigits={0}
          maxFractionDigits={2}
          suffix=" %"
          style={{ width: '100%' }}
          inputStyle={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>CGST %</label>
        <InputNumber
          value={state.cgstPercent}
          onValueChange={(e) =>
            setState((prev) => ({
              ...prev,
              cgstPercent: Number(e.value ?? 0),
            }))
          }
          min={0}
          minFractionDigits={0}
          maxFractionDigits={2}
          suffix=" %"
          style={{ width: '100%' }}
          inputStyle={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>IGST %</label>
        <InputNumber
          value={state.igstPercent}
          onValueChange={(e) =>
            setState((prev) => ({
              ...prev,
              igstPercent: Number(e.value ?? 0),
            }))
          }
          min={0}
          minFractionDigits={0}
          maxFractionDigits={2}
          suffix=" %"
          style={{ width: '100%' }}
          inputStyle={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>City</label>
        <InputText
          value={state.city}
          onChange={(e) =>
            setState((prev) => ({ ...prev, city: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field full">
        <label>Address</label>
        <InputText
          value={state.address}
          onChange={(e) =>
            setState((prev) => ({ ...prev, address: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>State</label>
        <InputText
          value={state.state}
          onChange={(e) =>
            setState((prev) => ({ ...prev, state: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>Pincode</label>
        <InputText
          value={state.pincode}
          onChange={(e) =>
            setState((prev) => ({ ...prev, pincode: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field full">
        <label>Notes</label>
        <InputText
          value={state.notes}
          onChange={(e) =>
            setState((prev) => ({ ...prev, notes: e.target.value }))
          }
          style={{ width: '100%' }}
        />
      </div>

      <div className="field full">
        <h3 style={{ margin: '0.35rem 0 0' }}>Terms &amp; conditions</h3>
        <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
          One clause per line. Placeholders: {TERM_PLACEHOLDER_HELP}
        </p>
      </div>
      <div className="field">
        <label>Payment days</label>
        <InputNumber
          value={state.paymentDays}
          onValueChange={(e) =>
            setState((prev) => ({
              ...prev,
              paymentDays: Number(e.value ?? 10),
            }))
          }
          min={1}
          useGrouping={false}
          style={{ width: '100%' }}
          inputStyle={{ width: '100%' }}
        />
      </div>
      <div className="field">
        <label>Insurance %</label>
        <InputNumber
          value={state.insurancePercent}
          onValueChange={(e) =>
            setState((prev) => ({
              ...prev,
              insurancePercent: Number(e.value ?? 2),
            }))
          }
          min={0}
          minFractionDigits={0}
          maxFractionDigits={2}
          suffix=" %"
          style={{ width: '100%' }}
          inputStyle={{ width: '100%' }}
        />
      </div>
      <div className="field">
        <label>Volumetric divisor</label>
        <InputNumber
          value={state.volumetricDivisor}
          onValueChange={(e) =>
            setState((prev) => ({
              ...prev,
              volumetricDivisor: Number(e.value ?? 5000),
            }))
          }
          min={1}
          useGrouping={false}
          style={{ width: '100%' }}
          inputStyle={{ width: '100%' }}
        />
      </div>
      <div className="field">
        <label>E-way bill threshold (₹)</label>
        <InputNumber
          value={state.ewayBillThreshold}
          onValueChange={(e) =>
            setState((prev) => ({
              ...prev,
              ewayBillThreshold: Number(e.value ?? 50000),
            }))
          }
          min={0}
          style={{ width: '100%' }}
          inputStyle={{ width: '100%' }}
        />
      </div>
      <div className="field full">
        <label>Clauses (one per line)</label>
        <Textarea
          value={state.termsText}
          onChange={(e) =>
            setState((prev) => ({ ...prev, termsText: e.target.value }))
          }
          rows={10}
          autoResize
          style={{ width: '100%' }}
        />
      </div>

      <div className="field">
        <label>Expired on</label>
        <InputText
          type="date"
          value={state.expiredOn}
          onChange={(e) =>
            setState((prev) => ({ ...prev, expiredOn: e.target.value }))
          }
          style={{ width: '100%' }}
        />
        <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
          After this date the user cannot log in. Leave blank for no expiry.
        </p>
      </div>

      <div className="field full account-status-row">
        <div>
          <label>Account status</label>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {state.isActive ? 'Active' : 'Inactive'}
          </p>
        </div>
        <ToggleSwitch
          checked={state.isActive}
          onChange={(e) =>
            setState((prev) => ({ ...prev, isActive: Boolean(e.value) }))
          }
        />
      </div>
    </div>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const list = useListParams({ sortOptions: USER_SORT_OPTIONS });
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [editForm, setEditForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['users', list.queryParams],
    queryFn: () => fetchPaginated<UserRow>('/users', list.queryParams),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleaned = trimFormData(form);
      await api.post('/users', {
        email: cleaned.email.toLowerCase(),
        password: cleaned.password,
        role: cleaned.userRole,
        isActive: cleaned.isActive,
        fullName: cleaned.fullName,
        phone: cleaned.phone || undefined,
        companyName: cleaned.companyName || undefined,
        gstin: cleaned.gstin || undefined,
        panNumber: cleaned.panNumber || undefined,
        bankName: cleaned.bankName || undefined,
        bankAccountNo: cleaned.bankAccountNo || undefined,
        bankIfsc: cleaned.bankIfsc || undefined,
        upiId: cleaned.upiId || undefined,
        sgstPercent: Number(form.sgstPercent ?? 9),
        cgstPercent: Number(form.cgstPercent ?? 9),
        igstPercent: Number(form.igstPercent ?? 0),
        address: cleaned.address || undefined,
        city: cleaned.city || undefined,
        state: cleaned.state || undefined,
        pincode: cleaned.pincode || undefined,
        notes: cleaned.notes || undefined,
        insurancePercent: Number(form.insurancePercent ?? 2),
        paymentDays: Number(form.paymentDays ?? 10),
        volumetricDivisor: Number(form.volumetricDivisor ?? 5000),
        ewayBillThreshold: Number(form.ewayBillThreshold ?? 50000),
        termsAndConditions: editorTextToTerms(form.termsText),
        expiredOn: cleaned.expiredOn || null,
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setError('');
      setFieldErrors({});
      setForm(EMPTY_USER_FORM);
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to create user';
      setError(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingUserId) return;
      const cleaned = trimFormData(editForm);
      const payload: Record<string, unknown> = {
        email: cleaned.email.toLowerCase(),
        role: cleaned.userRole,
        isActive: cleaned.isActive,
        fullName: cleaned.fullName,
        phone: cleaned.phone || null,
        companyName: cleaned.companyName || null,
        gstin: cleaned.gstin || null,
        panNumber: cleaned.panNumber || null,
        bankName: cleaned.bankName || null,
        bankAccountNo: cleaned.bankAccountNo || null,
        bankIfsc: cleaned.bankIfsc || null,
        upiId: cleaned.upiId || null,
        sgstPercent: Number(editForm.sgstPercent ?? 9),
        cgstPercent: Number(editForm.cgstPercent ?? 9),
        igstPercent: Number(editForm.igstPercent ?? 0),
        address: cleaned.address || null,
        city: cleaned.city || null,
        state: cleaned.state || null,
        pincode: cleaned.pincode || null,
        notes: cleaned.notes || null,
        insurancePercent: Number(editForm.insurancePercent ?? 2),
        paymentDays: Number(editForm.paymentDays ?? 10),
        volumetricDivisor: Number(editForm.volumetricDivisor ?? 5000),
        ewayBillThreshold: Number(editForm.ewayBillThreshold ?? 50000),
        termsAndConditions: editorTextToTerms(editForm.termsText),
        expiredOn: cleaned.expiredOn || null,
      };
      if (cleaned.password) {
        payload.password = cleaned.password;
      }
      await api.patch(`/users/${editingUserId}`, payload);
    },
    onSuccess: async () => {
      setEditOpen(false);
      setEditingUserId(null);
      setEditError('');
      setEditFieldErrors({});
      setEditForm(EMPTY_USER_FORM);
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to update user';
      setEditError(message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: UserRow) => {
      await api.patch(`/users/${row.id}`, { isActive: !row.isActive });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const blurCreateField = (key: UserFieldKey) => {
    const next = validateUserForm(form);
    setFieldErrors((prev) => ({ ...prev, [key]: next[key] || '' }));
  };

  const blurEditField = (key: UserFieldKey) => {
    const next = validateUserForm(editForm, { passwordOptional: true });
    setEditFieldErrors((prev) => ({ ...prev, [key]: next[key] || '' }));
  };

  const submitCreate = () => {
    const errors = validateUserForm(form);
    setFieldErrors(errors);
    if (firstError(errors)) {
      setError('Please fix the highlighted fields.');
      return;
    }
    setError('');
    createMutation.mutate();
  };

  const submitEdit = () => {
    const errors = validateUserForm(editForm, { passwordOptional: true });
    setEditFieldErrors(errors);
    if (firstError(errors)) {
      setEditError('Please fix the highlighted fields.');
      return;
    }
    setEditError('');
    updateMutation.mutate();
  };

  const openEdit = async (row: UserRow) => {
    setEditError('');
    setEditFieldErrors({});
    setEditLoading(true);
    setEditOpen(true);
    setEditingUserId(row.id);
    try {
      const res = await api.get(`/users/${row.id}`);
      const detail = unwrap<UserRow>(res.data);
      setEditForm(toFormFromUser(detail));
    } catch {
      setEditForm(toFormFromUser(row));
      setEditError('Could not load full profile; showing list data.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <Button
          label="Add user"
          icon="pi pi-plus"
          onClick={() => {
            setError('');
            setFieldErrors({});
            setForm(EMPTY_USER_FORM);
            setCreateOpen(true);
          }}
        />
      </div>
      <div className="panel">
        <ListFilterChrome
          meta={
            usersQuery.data?.meta ?? {
              page: list.page,
              pageSize: list.pageSize,
              total: 0,
            }
          }
          sortOptions={USER_SORT_OPTIONS}
          sortKey={list.sortKey}
          onSortChange={list.setSortKey}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          showClearFilters
          onClearFilters={list.clearFilters}
          clearFiltersDisabled={!list.hasActiveFilters}
        >
          <DataTable
            value={usersQuery.data?.data ?? []}
            loading={usersQuery.isLoading}
            columns={[
              {
                header: 'Full name',
                body: (row: UserRow) => row.userInfo?.fullName ?? '—',
              },
              { field: 'email', header: 'Email' },
              { field: 'role', header: 'Role' },
              {
                header: 'Company',
                body: (row: UserRow) => row.userInfo?.companyName ?? '—',
              },
              {
                header: 'Status',
                body: (row: UserRow) => (
                  <Tag severity={row.isActive ? 'success' : 'danger'}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                ),
              },
              {
                header: 'Expired on',
                body: (row: UserRow) => {
                  const expired = row.userInfo?.expiredOn;
                  if (!expired) return '—';
                  return (
                    <span
                      style={{
                        color: isExpiredPast(expired)
                          ? 'var(--status-error)'
                          : undefined,
                      }}
                    >
                      {formatExpiredOn(expired)}
                      {isExpiredPast(expired) ? ' · expired' : ''}
                    </span>
                  );
                },
              },
              {
                header: 'Actions',
                body: (row: UserRow) => (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      icon="pi pi-pencil"
                      label="Edit"
                      text
                      onClick={() => openEdit(row)}
                    />
                    <Button
                      size="small"
                      text
                      label={row.isActive ? 'Deactivate' : 'Activate'}
                      onClick={() => toggleMutation.mutate(row)}
                    />
                  </div>
                ),
              },
            ]}
          />
        </ListFilterChrome>
      </div>

      <Dialog
        header="New user"
        visible={createOpen}
        onHide={() => setCreateOpen(false)}
        style={{ width: 'min(640px, 95vw)' }}
      >
        <UserFormFields
          state={form}
          setState={setForm}
          errors={fieldErrors}
          setErrors={setFieldErrors}
          onBlurField={blurCreateField}
        />
        {error ? <p className="error-text">{error}</p> : null}
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Button
            label="Create"
            loading={createMutation.isPending}
            onClick={submitCreate}
          />
        </div>
      </Dialog>

      <Dialog
        header="Edit user information"
        visible={editOpen}
        onHide={() => {
          setEditOpen(false);
          setEditingUserId(null);
        }}
        style={{ width: 'min(640px, 95vw)' }}
      >
        {editLoading ? (
          <p className="muted">Loading user…</p>
        ) : (
          <UserFormFields
            state={editForm}
            setState={setEditForm}
            errors={editFieldErrors}
            setErrors={setEditFieldErrors}
            onBlurField={blurEditField}
            passwordOptional
          />
        )}
        {editError ? <p className="error-text">{editError}</p> : null}
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <Button
            label="Cancel"
            severity="secondary"
            text
            onClick={() => {
              setEditOpen(false);
              setEditingUserId(null);
            }}
          />
          <Button
            label="Save changes"
            loading={updateMutation.isPending}
            disabled={editLoading}
            onClick={submitEdit}
          />
        </div>
      </Dialog>
    </div>
  );
}
