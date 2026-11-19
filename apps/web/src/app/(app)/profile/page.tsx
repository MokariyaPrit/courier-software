'use client';

import {
  Button,
  Dialog,
  InputNumber,
  InputText,
  Textarea,
  Tag,
} from '@/components/ui';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  FieldErrors,
  firstError,
  validateEmail,
  validateFullName,
} from '@/lib/form-validation';
import { GMAIL_SMTP, normalizeGmailAppPassword } from '@/lib/gmail-smtp';
import { mediaUrl } from '@/lib/media-url';
import { uploadFile } from '@/lib/r2-upload';
import {
  TERM_PLACEHOLDER_HELP,
  editorTextToTerms,
  termsToEditorText,
} from '@/lib/terms-and-conditions';
import { apiErrorMessage, toastError } from '@/lib/toast';
import { trimFormData } from '@/lib/trim';

const LOGO_MAX_BYTES = 10 * 1024 * 1024;

interface GmailFormState {
  gmailEmail: string;
  appPassword: string;
}

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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [smtpError, setSmtpError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [gmailForm, setGmailForm] = useState<GmailFormState>({
    gmailEmail: '',
    appPassword: '',
  });
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
    setGmailForm({
      gmailEmail:
        info?.smtpUser || info?.smtpFromEmail || '',
      appPassword: '',
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

  const openLogoPicker = () => {
    const input = logoInputRef.current;
    if (!input || logoBusy) return;
    // Reset so picking the same file again still fires change.
    input.value = '';
    input.click();
  };

  const uploadLogo = async (file: File | null) => {
    if (!file) return;
    setLogoBusy(true);
    setLogoError('');
    try {
      const uploaded = await uploadFile(file, {
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        maxFileSizeBytes: LOGO_MAX_BYTES,
      });
      await api.post(
        '/auth/profile/logo',
        { tempKey: uploaded.key, fileLabel: uploaded.originalName },
        {
          toastSummary: 'Logo saved',
          toastDetail: 'Company logo updated for booking receipts.',
        },
      );
      await refreshMe();
    } catch (err: unknown) {
      showLogoError(err);
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    setLogoError('');
    try {
      await api.delete('/auth/profile/logo', {
        toastSummary: 'Logo removed',
      });
      await refreshMe();
    } catch (err: unknown) {
      showLogoError(err);
    } finally {
      setLogoBusy(false);
    }
  };

  function showLogoError(err: unknown) {
    const message = apiErrorMessage(err, 'Logo update failed');
    setLogoError(message);
    toastError('Logo upload failed', message);
  }

  const openSmtpEdit = () => {
    setSmtpError('');
    setGmailForm({
      gmailEmail: info?.smtpUser || info?.smtpFromEmail || '',
      appPassword: '',
    });
    setSmtpOpen(true);
  };

  const saveGmail = async () => {
    setSmtpSaving(true);
    setSmtpError('');
    try {
      const email = gmailForm.gmailEmail.trim().toLowerCase();
      const emailErr = validateEmail(email);
      if (emailErr) {
        setSmtpError(emailErr);
        setSmtpSaving(false);
        return;
      }
      const password = normalizeGmailAppPassword(gmailForm.appPassword);
      if (!info?.smtpConfigured && !password) {
        setSmtpError('Google App Password is required');
        setSmtpSaving(false);
        return;
      }
      if (password && password.length < 16) {
        setSmtpError(
          'Use a 16-character Google App Password (not your normal Gmail password)',
        );
        setSmtpSaving(false);
        return;
      }

      const payload: Record<string, unknown> = {
        smtpHost: GMAIL_SMTP.host,
        smtpPort: GMAIL_SMTP.port,
        smtpSecure: GMAIL_SMTP.secure,
        smtpUser: email,
        smtpFromEmail: email,
      };
      if (password) {
        payload.smtpPassword = password;
      }
      await api.patch('/auth/profile', payload, {
        toastSummary: 'Gmail saved',
        toastDetail: 'Quotations and invoices can be emailed from this Gmail.',
      });
      await refreshMe();
      setSmtpOpen(false);
    } catch (err: unknown) {
      setSmtpError(apiErrorMessage(err, 'Failed to save Gmail settings'));
    } finally {
      setSmtpSaving(false);
    }
  };

  const clearGmail = async () => {
    setSmtpSaving(true);
    setSmtpError('');
    try {
      await api.patch(
        '/auth/profile',
        { smtpHost: null },
        {
          toastSummary: 'Gmail disconnected',
          toastDetail: 'Outgoing email was removed from this profile.',
        },
      );
      await refreshMe();
      setSmtpOpen(false);
    } catch (err: unknown) {
      setSmtpError(apiErrorMessage(err, 'Failed to disconnect Gmail'));
    } finally {
      setSmtpSaving(false);
    }
  };

  const testSmtp = async () => {
    setSmtpTesting(true);
    setSmtpError('');
    try {
      await api.post('/auth/profile/smtp/test', undefined, {
        toastSummary: 'Test email sent',
        toastDetail: 'Check your Gmail inbox for the test message.',
      });
    } catch (err: unknown) {
      setSmtpError(apiErrorMessage(err, 'Gmail test failed'));
    } finally {
      setSmtpTesting(false);
    }
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
          <div className="profile-row">
            <span className="profile-label">Company logo</span>
            <span className="profile-value">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                {info?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(info.logoUrl)}
                    alt="Company logo"
                    style={{
                      maxHeight: 56,
                      maxWidth: 180,
                      objectFit: 'contain',
                      border: '1px solid var(--surface-border, #ddd)',
                      borderRadius: 4,
                      background: '#fff',
                      padding: 4,
                    }}
                  />
                ) : (
                  <span className="muted">No logo uploaded</span>
                )}
                {/*
                  Avoid display:none — on Windows it often breaks first-select /
                  double-click in the native file dialog.
                */}
                <input
                  id="profile-logo-input"
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
                  tabIndex={-1}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: 0,
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    void uploadLogo(file);
                  }}
                />
                <Button
                  type="button"
                  label={info?.logoUrl ? 'Replace' : 'Upload'}
                  icon="pi pi-upload"
                  size="small"
                  outlined
                  loading={logoBusy}
                  disabled={logoBusy}
                  onClick={openLogoPicker}
                />
                {info?.logoUrl ? (
                  <Button
                    label="Remove"
                    icon="pi pi-trash"
                    size="small"
                    text
                    severity="danger"
                    loading={logoBusy}
                    disabled={logoBusy}
                    onClick={() => void removeLogo()}
                  />
                ) : null}
              </div>
              <span className="muted" style={{ display: 'block', fontSize: '0.8rem', marginTop: 4 }}>
                Shown on cash / account booking receipts. Max 10 MB (PNG, JPG, WEBP).
              </span>
              {logoError ? (
                <p className="error-text" style={{ margin: '0.35rem 0 0' }}>
                  {logoError}
                </p>
              ) : null}
            </span>
          </div>
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
            <h2>Gmail (send quotations &amp; invoices)</h2>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <Button
                label="Test"
                icon="pi pi-send"
                text
                size="small"
                disabled={!info?.smtpConfigured}
                loading={smtpTesting}
                onClick={() => void testSmtp()}
              />
              <Button
                label={info?.smtpConfigured ? 'Change' : 'Connect Gmail'}
                icon="pi pi-pencil"
                text
                size="small"
                onClick={openSmtpEdit}
              />
            </div>
          </div>
          <div className="profile-row">
            <span className="profile-label">Status</span>
            <span className="profile-value">
              <Tag severity={info?.smtpConfigured ? 'success' : 'warning'}>
                {info?.smtpConfigured ? 'Gmail connected' : 'Not connected'}
              </Tag>
            </span>
          </div>
          <InfoRow label="Provider" value="Google Gmail" />
          <InfoRow
            label="Gmail address"
            value={info?.smtpUser || info?.smtpFromEmail}
          />
          <p className="muted" style={{ margin: '0.75rem 0 0', fontSize: '0.85rem' }}>
            Only your Google email and a Google App Password are needed.
            Server settings (smtp.gmail.com : 587) are applied automatically.
          </p>
          {smtpError && !smtpOpen ? (
            <p className="error-text" style={{ marginTop: '0.5rem' }}>
              {smtpError}
            </p>
          ) : null}
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

      <Dialog
        header="Connect Gmail"
        visible={smtpOpen}
        style={{ width: 'min(520px, 95vw)' }}
        onHide={() => setSmtpOpen(false)}
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Enter your Google email and a Google App Password. Host and port are
          fixed to Gmail ({GMAIL_SMTP.host}:{GMAIL_SMTP.port}).
        </p>
        <ol
          className="muted"
          style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', fontSize: '0.9rem' }}
        >
          <li>Open Google Account → Security → 2-Step Verification (must be on).</li>
          <li>
            Create an{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
            >
              App Password
            </a>{' '}
            for “Mail”.
          </li>
          <li>Paste the 16-character password below (spaces are OK).</li>
        </ol>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="gmailEmail">Gmail address</label>
            <InputText
              id="gmailEmail"
              value={gmailForm.gmailEmail}
              placeholder="you@gmail.com"
              autoComplete="off"
              onChange={(e) =>
                setGmailForm((prev) => ({
                  ...prev,
                  gmailEmail: e.target.value,
                }))
              }
              style={{ width: '100%' }}
            />
          </div>
          <div className="field full">
            <label htmlFor="gmailAppPassword">Google App Password</label>
            <InputText
              id="gmailAppPassword"
              type="password"
              value={gmailForm.appPassword}
              placeholder={
                info?.smtpConfigured
                  ? 'Leave blank to keep current password'
                  : 'xxxx xxxx xxxx xxxx'
              }
              autoComplete="new-password"
              onChange={(e) =>
                setGmailForm((prev) => ({
                  ...prev,
                  appPassword: e.target.value,
                }))
              }
              style={{ width: '100%' }}
            />
          </div>
        </div>
        {smtpError ? <p className="error-text">{smtpError}</p> : null}
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          {info?.smtpConfigured ? (
            <Button
              label="Disconnect"
              severity="danger"
              text
              loading={smtpSaving}
              onClick={() => void clearGmail()}
            />
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <Button
              label="Cancel"
              severity="secondary"
              text
              onClick={() => setSmtpOpen(false)}
            />
            <Button
              label="Save Gmail"
              loading={smtpSaving}
              onClick={() => void saveGmail()}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
