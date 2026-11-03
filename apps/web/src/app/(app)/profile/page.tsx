'use client';

import {
  Button,
  Dialog,
  InputNumber,
  InputText,
  Textarea,
  Tag,
} from '@/components/ui';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  FieldErrors,
  firstError,
  validateEmail,
  validateFullName,
} from '@/lib/form-validation';
import {
  TERM_PLACEHOLDER_HELP,
  editorTextToTerms,
  termsToEditorText,
} from '@/lib/terms-and-conditions';
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
}

type ProfileFieldKey = keyof ProfileFormState;

const OPTIONAL_FIELDS = new Set<ProfileFieldKey>([
  'phone',
  'companyName',
  'gstin',
  'panNumber',
  'bankName',
  'bankAccountNo',
  'bankIfsc',
  'upiId',
  'sgstPercent',
  'cgstPercent',
  'igstPercent',
  'address',
  'city',
  'state',
  'pincode',
  'notes',
  'insurancePercent',
  'paymentDays',
  'volumetricDivisor',
  'ewayBillThreshold',
  'termsText',
]);

function validateProfileField(key: ProfileFieldKey, value: string): string {
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
    termsText: '',
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: info?.phone || '',
      companyName: info?.companyName || '',
      gstin: info?.gstin || '',
      panNumber: info?.panNumber || '',
      bankName: info?.bankName || '',
      bankAccountNo: info?.bankAccountNo || '',
      bankIfsc: info?.bankIfsc || '',
      upiId: info?.upiId || '',
      sgstPercent: Number(info?.sgstPercent ?? 9),
      cgstPercent: Number(info?.cgstPercent ?? 9),
      igstPercent: Number(info?.igstPercent ?? 0),
      address: info?.address || '',
      city: info?.city || '',
      state: info?.state || '',
      pincode: info?.pincode || '',
      notes: info?.notes || '',
      insurancePercent: Number(info?.insurancePercent ?? 2),
      paymentDays: Number(info?.paymentDays ?? 10),
      volumetricDivisor: Number(info?.volumetricDivisor ?? 5000),
      ewayBillThreshold: Number(info?.ewayBillThreshold ?? 50000),
      termsText: termsToEditorText(info?.termsAndConditions),
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
    const msg = validateProfileField(key, String(form[key] ?? ''));
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
        panNumber: cleaned.panNumber || null,
        bankName: cleaned.bankName || null,
        bankAccountNo: cleaned.bankAccountNo || null,
        bankIfsc: cleaned.bankIfsc || null,
        upiId: cleaned.upiId || null,
        sgstPercent: Number(form.sgstPercent ?? 9),
        cgstPercent: Number(form.cgstPercent ?? 9),
        igstPercent: Number(form.igstPercent ?? 0),
        address: cleaned.address || null,
        city: cleaned.city || null,
        state: cleaned.state || null,
        pincode: cleaned.pincode || null,
        notes: cleaned.notes || null,
        insurancePercent: Number(form.insurancePercent ?? 2),
        paymentDays: Number(form.paymentDays ?? 10),
        volumetricDivisor: Number(form.volumetricDivisor ?? 5000),
        ewayBillThreshold: Number(form.ewayBillThreshold ?? 50000),
        termsAndConditions: editorTextToTerms(form.termsText),
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

  const textFields = [
    ['fullName', 'Full name'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['companyName', 'Company name'],
    ['gstin', 'GSTIN'],
    ['panNumber', 'PAN number'],
    ['bankName', 'Bank name'],
    ['bankAccountNo', 'Acc. No.'],
    ['bankIfsc', 'IFSC code'],
    ['upiId', 'UPI ID'],
    ['address', 'Address'],
    ['city', 'City'],
    ['state', 'State'],
    ['pincode', 'Pincode'],
    ['notes', 'Notes'],
  ] as const;

  const termsPreview = info?.termsAndConditions?.length
    ? info.termsAndConditions
    : null;
  const termsCount = termsPreview?.length ?? 'defaults';

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
              <Tag severity={user.isActive ? 'success' : 'danger'}>
                {user.isActive ? 'Active' : 'Inactive'}
              </Tag>
            </span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Expired on</span>
            <span className="profile-value">
              {info?.expiredOn
                ? new Date(
                    `${String(info.expiredOn).slice(0, 10)}T00:00:00`,
                  ).toLocaleDateString('en-IN')
                : '—'}
              <span className="muted" style={{ display: 'block', fontSize: '0.8rem' }}>
                Set by admin · view only
              </span>
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
          <InfoRow label="PAN number" value={info?.panNumber} />
          <InfoRow label="Bank name" value={info?.bankName} />
          <InfoRow label="Acc. No." value={info?.bankAccountNo} />
          <InfoRow label="IFSC code" value={info?.bankIfsc} />
          <InfoRow label="UPI ID" value={info?.upiId} />
          <InfoRow
            label="SGST / UTGST %"
            value={String(info?.sgstPercent ?? '9.00')}
          />
          <InfoRow label="CGST %" value={String(info?.cgstPercent ?? '9.00')} />
          <InfoRow label="IGST %" value={String(info?.igstPercent ?? '0.00')} />
          <InfoRow label="Address" value={info?.address} />
          <InfoRow label="City" value={info?.city} />
          <InfoRow label="State" value={info?.state} />
          <InfoRow label="Pincode" value={info?.pincode} />
          <InfoRow label="Notes" value={info?.notes} />
        </section>

        <section className="panel profile-card" style={{ gridColumn: '1 / -1' }}>
          <div className="profile-card-header">
            <h2>Terms &amp; conditions</h2>
            <Button
              label="Edit"
              icon="pi pi-pencil"
              text
              size="small"
              onClick={openEdit}
            />
          </div>
          <InfoRow
            label="Payment days"
            value={String(info?.paymentDays ?? 10)}
          />
          <InfoRow
            label="Insurance %"
            value={String(info?.insurancePercent ?? '2')}
          />
          <InfoRow
            label="Volumetric divisor"
            value={String(info?.volumetricDivisor ?? 5000)}
          />
          <InfoRow
            label="E-way bill threshold"
            value={
              info?.ewayBillThreshold != null
                ? Number(info.ewayBillThreshold).toLocaleString('en-IN')
                : '50,000'
            }
          />
          <InfoRow
            label="Clauses"
            value={
              typeof termsCount === 'number'
                ? `${termsCount} custom lines`
                : 'Using system defaults'
            }
          />
          {termsPreview ? (
            <ul className="profile-terms-preview">
              {termsPreview.slice(0, 4).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
              {termsPreview.length > 4 ? (
                <li className="muted">…and {termsPreview.length - 4} more</li>
              ) : null}
            </ul>
          ) : (
            <p className="muted" style={{ margin: '0.5rem 0 0' }}>
              Defaults include payment, restricted items, volumetric weight,
              GST, FOV, insurance, liability, and fuel surcharge — with
              placeholders filled at print time.
            </p>
          )}
        </section>
      </div>

      <Dialog
        header="Edit user information"
        visible={editOpen}
        style={{ width: 'min(720px, 95vw)' }}
        onHide={() => setEditOpen(false)}
      >
        <div className="form-grid">
          {textFields.map(([key, label]) => {
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
                  value={String(form[key] ?? '')}
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
          <div className="field">
            <label>SGST / UTGST %</label>
            <InputNumber
              value={form.sgstPercent}
              onValueChange={(e) =>
                setForm((prev) => ({
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
              value={form.cgstPercent}
              onValueChange={(e) =>
                setForm((prev) => ({
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
              value={form.igstPercent}
              onValueChange={(e) =>
                setForm((prev) => ({
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

          <div className="field full">
            <h3 style={{ margin: '0.5rem 0 0' }}>Terms &amp; conditions</h3>
            <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
              One clause per line. Placeholders: {TERM_PLACEHOLDER_HELP}. GST %
              uses IGST when set, otherwise SGST+CGST. FOV / fuel % come from the
              party / quotation.
            </p>
          </div>
          <div className="field">
            <label>Payment days</label>
            <InputNumber
              value={form.paymentDays}
              onValueChange={(e) =>
                setForm((prev) => ({
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
              value={form.insurancePercent}
              onValueChange={(e) =>
                setForm((prev) => ({
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
              value={form.volumetricDivisor}
              onValueChange={(e) =>
                setForm((prev) => ({
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
              value={form.ewayBillThreshold}
              onValueChange={(e) =>
                setForm((prev) => ({
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
            <label htmlFor="termsText">Clauses (one per line)</label>
            <Textarea
              id="termsText"
              value={form.termsText}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, termsText: e.target.value }))
              }
              rows={14}
              autoResize
              style={{ width: '100%' }}
            />
          </div>
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
