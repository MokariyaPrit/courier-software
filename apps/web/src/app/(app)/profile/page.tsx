'use client';

import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  FieldErrors,
  firstError,
  validateEmail,
  validateFullName,
} from '@/lib/form-validation';
import { trimFormData } from '@/lib/trim';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="profile-row">
      <span className="profile-label">{label}</span>
      <span className="profile-value">{value?.trim() ? value : '—'}</span>
    </div>
  );
}

interface ProfileFormState {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
}

type ProfileFieldKey = keyof ProfileFormState;

const OPTIONAL_FIELDS = new Set<ProfileFieldKey>([
  'phone',
  'companyName',
  'gstin',
  'address',
  'city',
  'state',
  'pincode',
  'notes',
]);

function validateProfileField(
  key: ProfileFieldKey,
  value: string,
): string {
  if (key === 'fullName') return validateFullName(value);
  if (key === 'email') return validateEmail(value);
  return '';
}

function validateProfileForm(form: ProfileFormState): FieldErrors {
  return {
    fullName: validateFullName(form.fullName),
    email: validateEmail(form.email),
  };
}

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const info = user?.userInfo;
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<ProfileFormState>({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    notes: '',
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: info?.phone || '',
      companyName: info?.companyName || '',
      gstin: info?.gstin || '',
      address: info?.address || '',
      city: info?.city || '',
      state: info?.state || '',
      pincode: info?.pincode || '',
      notes: info?.notes || '',
    });
  }, [user, info]);

  if (!user) {
    return <p className="muted">Loading profile…</p>;
  }

  const openEdit = () => {
    setErrorMessage('');
    setFieldErrors({});
    setEditOpen(true);
  };

  const blurField = (key: ProfileFieldKey) => {
    if (OPTIONAL_FIELDS.has(key)) return;
    const msg = validateProfileField(key, form[key]);
    setFieldErrors((prev) => ({ ...prev, [key]: msg }));
  };

  const saveProfile = async () => {
    const errors = validateProfileForm(form);
    setFieldErrors(errors);
    if (firstError(errors)) {
      setErrorMessage('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      const cleaned = trimFormData(form);
      await api.patch('/auth/profile', {
        fullName: cleaned.fullName,
        email: cleaned.email.toLowerCase(),
        phone: cleaned.phone || null,
        companyName: cleaned.companyName || null,
        gstin: cleaned.gstin || null,
        address: cleaned.address || null,
        city: cleaned.city || null,
        state: cleaned.state || null,
        pincode: cleaned.pincode || null,
        notes: cleaned.notes || null,
      });
      await refreshMe();
      setEditOpen(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to update profile';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    ['fullName', 'Full name'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['companyName', 'Company name'],
    ['gstin', 'GSTIN'],
    ['address', 'Address'],
    ['city', 'City'],
    ['state', 'State'],
    ['pincode', 'Pincode'],
    ['notes', 'Notes'],
  ] as const;

  return (
    <div>
      <div className="page-header">
        <h1>Profile</h1>
        <Button label="Edit user information" icon="pi pi-pencil" onClick={openEdit} />
      </div>

      <div className="profile-grid">
        <section className="panel profile-card">
          <h2>Account</h2>
          <InfoRow label="Full name" value={user.fullName} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="User role" value={user.role.replace(/_/g, ' ')} />
          <div className="profile-row">
            <span className="profile-label">Account status</span>
            <span className="profile-value">
              <Tag
                value={user.isActive ? 'Active' : 'Inactive'}
                severity={user.isActive ? 'success' : 'danger'}
              />
            </span>
          </div>
        </section>

        <section className="panel profile-card">
          <div className="profile-card-header">
            <h2>User information</h2>
            <Button
              label="Edit"
              icon="pi pi-pencil"
              text
              size="small"
              onClick={openEdit}
            />
          </div>
          <InfoRow label="Phone" value={info?.phone} />
          <InfoRow label="Company name" value={info?.companyName} />
          <InfoRow label="GSTIN" value={info?.gstin} />
          <InfoRow label="Address" value={info?.address} />
          <InfoRow label="City" value={info?.city} />
          <InfoRow label="State" value={info?.state} />
          <InfoRow label="Pincode" value={info?.pincode} />
          <InfoRow label="Notes" value={info?.notes} />
        </section>
      </div>

      <Dialog
        header="Edit user information"
        visible={editOpen}
        style={{ width: 'min(560px, 95vw)' }}
        onHide={() => setEditOpen(false)}
      >
        <div className="form-grid">
          {fields.map(([key, label]) => {
            const err = fieldErrors[key];
            const isWide = key === 'address' || key === 'notes';
            return (
              <div
                className={`field${isWide ? ' full' : ''}${err ? ' has-error' : ''}`}
                key={key}
              >
                <label htmlFor={key}>{label}</label>
                <InputText
                  id={key}
                  value={form[key]}
                  className={err ? 'p-invalid' : undefined}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, [key]: value }));
                    if (err) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        [key]: validateProfileField(key, value),
                      }));
                    }
                  }}
                  onBlur={() => blurField(key)}
                  style={{ width: '100%' }}
                />
                {err ? <small className="field-error">{err}</small> : null}
              </div>
            );
          })}
        </div>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button
            label="Cancel"
            severity="secondary"
            text
            onClick={() => setEditOpen(false)}
          />
          <Button label="Save changes" loading={saving} onClick={saveProfile} />
        </div>
      </Dialog>
    </div>
  );
}
