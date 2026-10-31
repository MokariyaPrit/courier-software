'use client';

import { Role } from '@courier/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { trimFormData } from '@/lib/trim';

interface SignupFormState {
  fullName: string;
  emailAddress: string;
  password: string;
  confirmPassword: string;
  userRole: Role;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  companyName: string;
  gstin: string;
  notes: string;
  isActive: boolean;
}

const INITIAL_FORM: SignupFormState = {
  fullName: '',
  emailAddress: '',
  password: '',
  confirmPassword: '',
  userRole: Role.BRANCH_MANAGER,
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  companyName: '',
  gstin: '',
  notes: '',
  isActive: true,
};

const ROLE_OPTIONS = [
  { label: 'Admin', value: Role.ADMIN },
  { label: 'Branch Manager', value: Role.BRANCH_MANAGER },
];

export default function SignupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<SignupFormState>(INITIAL_FORM);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  const updateField = <K extends keyof SignupFormState>(
    key: K,
    value: SignupFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (form.password !== form.confirmPassword) {
      setErrorMessage('Password and confirm password do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleaned = trimFormData(form);
      await api.post('/auth/signup', {
        email: cleaned.emailAddress.toLowerCase(),
        password: cleaned.password,
        role: cleaned.userRole,
        isActive: cleaned.isActive,
        fullName: cleaned.fullName,
        phone: cleaned.phone || undefined,
        address: cleaned.address || undefined,
        city: cleaned.city || undefined,
        state: cleaned.state || undefined,
        pincode: cleaned.pincode || undefined,
        companyName: cleaned.companyName || undefined,
        gstin: cleaned.gstin || undefined,
        notes: cleaned.notes || undefined,
      });
      setSuccessMessage(
        form.isActive
          ? 'Account created. You can sign in now.'
          : 'Account created as Inactive. Activate it before login.',
      );
      setForm(INITIAL_FORM);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Signup failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card signup-card" onSubmit={onSubmit}>
        <h1>Create account</h1>
        <p>Register Admin or Branch Manager with user information</p>

        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <InputText
            id="fullName"
            value={form.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="emailAddress">Email address (login)</label>
          <InputText
            id="emailAddress"
            type="email"
            value={form.emailAddress}
            onChange={(e) => updateField('emailAddress', e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <Password
            id="password"
            feedback={false}
            toggleMask
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            inputStyle={{ width: '100%' }}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <Password
            id="confirmPassword"
            feedback={false}
            toggleMask
            value={form.confirmPassword}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
            inputStyle={{ width: '100%' }}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="userRole">User role</label>
          <Dropdown
            id="userRole"
            value={form.userRole}
            options={ROLE_OPTIONS}
            onChange={(e) => updateField('userRole', e.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone</label>
          <InputText
            id="phone"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="companyName">Company name</label>
          <InputText
            id="companyName"
            value={form.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="gstin">GSTIN</label>
          <InputText
            id="gstin"
            value={form.gstin}
            onChange={(e) => updateField('gstin', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="address">Address</label>
          <InputText
            id="address"
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="city">City</label>
          <InputText
            id="city"
            value={form.city}
            onChange={(e) => updateField('city', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="state">State</label>
          <InputText
            id="state"
            value={form.state}
            onChange={(e) => updateField('state', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="pincode">Pincode</label>
          <InputText
            id="pincode"
            value={form.pincode}
            onChange={(e) => updateField('pincode', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label htmlFor="notes">Notes</label>
          <InputText
            id="notes"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field account-status-row">
          <div>
            <label htmlFor="isActive">Account status</label>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              {form.isActive ? 'Active — can sign in' : 'Inactive — cannot sign in'}
            </p>
          </div>
          <InputSwitch
            id="isActive"
            checked={form.isActive}
            onChange={(e) => updateField('isActive', Boolean(e.value))}
          />
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {successMessage ? <p className="success-text">{successMessage}</p> : null}

        <Button
          type="submit"
          label="Create account"
          loading={isSubmitting}
          style={{ width: '100%' }}
        />

        <p className="auth-footer-link">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
