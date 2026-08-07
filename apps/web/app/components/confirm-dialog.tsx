'use client';

import { AlertTriangle, LogOut, X } from 'lucide-react';

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = 'default',
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button
        className="confirm-dialog-backdrop"
        type="button"
        onClick={onCancel}
        aria-label="Cancel"
      />
      <section>
        <div className={`confirm-dialog-icon ${tone === 'danger' ? 'is-danger' : ''}`}>
          {tone === 'danger' ? <LogOut aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
        </div>
        <button
          className="confirm-dialog-close"
          type="button"
          onClick={onCancel}
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </button>
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={tone === 'danger' ? 'is-danger' : ''}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
