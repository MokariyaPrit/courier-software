'use client';

import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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
  phone: string;
  infoEmail: string;
  companyName: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
}

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const info = user?.userInfo;
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState<ProfileFormState>({
    fullName: '',
    phone: '',
    infoEmail: '',
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
      phone: info?.phone || '',
      infoEmail: info?.email || '',
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
    setEditOpen(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    setErrorMessage('');
    try {
      await api.patch('/auth/profile', {
        fullName: form.fullName.trim(),
        phone: form.phone || null,
        infoEmail: form.infoEmail || null,
        companyName: form.companyName || null,
        gstin: form.gstin || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        notes: form.notes || null,
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
          <InfoRow label="Login email" value={user.email} />
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
          <InfoRow label="Contact email" value={info?.email} />
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
          {(
            [
              ['fullName', 'Full name'],
              ['phone', 'Phone'],
              ['infoEmail', 'Contact email'],
              ['companyName', 'Company name'],
              ['gstin', 'GSTIN'],
              ['address', 'Address'],
              ['city', 'City'],
              ['state', 'State'],
              ['pincode', 'Pincode'],
              ['notes', 'Notes'],
            ] as const
          ).map(([key, label]) => (
            <div
              className={`field ${key === 'address' || key === 'notes' ? 'full' : ''}`}
              key={key}
            >
              <label htmlFor={key}>{label}</label>
              <InputText
                id={key}
                value={form[key]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [key]: e.target.value }))
                }
                style={{ width: '100%' }}
              />
            </div>
          ))}
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
