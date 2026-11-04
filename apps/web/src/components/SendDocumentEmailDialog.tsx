'use client';

import { Button, Dialog, InputText, Textarea } from '@/components/ui';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/toast';

type Props = {
  visible: boolean;
  onHide: () => void;
  title: string;
  endpoint: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultMessage?: string;
};

export function SendDocumentEmailDialog({
  visible,
  onHide,
  title,
  endpoint,
  defaultTo = '',
  defaultSubject = '',
  defaultMessage = '',
}: Props) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTo(defaultTo);
    setCc('');
    setSubject(defaultSubject);
    setMessage(defaultMessage);
    setError('');
  }, [visible, defaultTo, defaultSubject, defaultMessage]);

  const send = async () => {
    if (!to.trim()) {
      setError('Recipient email is required');
      return;
    }
    setSending(true);
    setError('');
    try {
      await api.post(
        endpoint,
        {
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim() || undefined,
          message: message.trim() || undefined,
        },
        {
          toastSummary: 'Email sent',
          toastDetail: `Sent to ${to.trim()}`,
        },
      );
      onHide();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to send email'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      header={title}
      visible={visible}
      style={{ width: 'min(520px, 95vw)' }}
      onHide={onHide}
    >
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="email-to">To</label>
          <InputText
            id="email-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="field full">
          <label htmlFor="email-cc">CC (optional)</label>
          <InputText
            id="email-cc"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="field full">
          <label htmlFor="email-subject">Subject</label>
          <InputText
            id="email-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="field full">
          <label htmlFor="email-message">Message (optional)</label>
          <Textarea
            id="email-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            autoResize
            style={{ width: '100%' }}
          />
        </div>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div
        style={{
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem',
        }}
      >
        <Button label="Cancel" severity="secondary" text onClick={onHide} />
        <Button
          label="Send email"
          icon="pi pi-send"
          loading={sending}
          onClick={() => void send()}
        />
      </div>
    </Dialog>
  );
}
