'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { trimFormData } from '@/lib/trim';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin@courier.local');
  const [password, setPassword] = useState('Admin@12345');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const cleaned = trimFormData({ email, password });
      await login(cleaned.email, cleaned.password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Courier ERP</h1>
        <p>Sign in as Admin or Branch Manager</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <InputText
            id="email"
            className="w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <Password
            id="password"
            feedback={false}
            toggleMask
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputStyle={{ width: '100%' }}
            style={{ width: '100%' }}
          />
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <Button
          type="submit"
          label="Sign in"
          loading={submitting}
          style={{ width: '100%' }}
        />
        <p className="auth-footer-link">
          New user? <Link href="/signup">Create account</Link>
        </p>
      </form>
    </div>
  );
}
