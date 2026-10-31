'use client';

import { Role } from '@courier/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Dispatch, SetStateAction, useState } from 'react';
import { PasswordInput } from '@/components/PasswordInput';
import { api, unwrap } from '@/lib/api';
import {
  FieldErrors,
  firstError,
  validateEmail,
  validateFullName,
  validatePassword,
} from '@/lib/form-validation';
import { trimFormData } from '@/lib/trim';

interface UserInfoFields {
  fullName: string;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  notes: string | null;
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
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
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
  address: '',
  city: '',
  state: '',
  pincode: '',
  notes: '',
  isActive: true,
};

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
    address: user.userInfo?.address || '',
    city: user.userInfo?.city || '',
    state: user.userInfo?.state || '',
    pincode: user.userInfo?.pincode || '',
    notes: user.userInfo?.notes || '',
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
        <Dropdown
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

      <div className="field full account-status-row">
        <div>
          <label>Account status</label>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {state.isActive ? 'Active' : 'Inactive'}
          </p>
        </div>
        <InputSwitch
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
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { pageSize: 100 } });
      return (res.data as { data: UserRow[] }).data;
    },
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
        address: cleaned.address || undefined,
        city: cleaned.city || undefined,
        state: cleaned.state || undefined,
        pincode: cleaned.pincode || undefined,
        notes: cleaned.notes || undefined,
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
        address: cleaned.address || null,
        city: cleaned.city || null,
        state: cleaned.state || null,
        pincode: cleaned.pincode || null,
        notes: cleaned.notes || null,
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
        <DataTable value={usersQuery.data ?? []} loading={usersQuery.isLoading}>
          <Column
            header="Full name"
            body={(row: UserRow) => row.userInfo?.fullName ?? '—'}
          />
          <Column field="email" header="Email" />
          <Column field="role" header="Role" />
          <Column
            header="Company"
            body={(row: UserRow) => row.userInfo?.companyName ?? '—'}
          />
          <Column
            header="Status"
            body={(row: UserRow) => (
              <Tag
                value={row.isActive ? 'Active' : 'Inactive'}
                severity={row.isActive ? 'success' : 'danger'}
              />
            )}
          />
          <Column
            header="Actions"
            body={(row: UserRow) => (
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
            )}
          />
        </DataTable>
      </div>

      <Dialog
        header="New user"
        visible={createOpen}
        onHide={() => setCreateOpen(false)}
        style={{ width: 'min(560px, 95vw)' }}
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
        style={{ width: 'min(560px, 95vw)' }}
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
