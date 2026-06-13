'use client';

import { useEffect, useState } from 'react';
import { Cloud } from 'lucide-react';
import {
  connectSetupCloud,
  fetchSetupCloudStatus,
  type SetupCloudStatus,
} from '@/lib/mastyff-ai-api';
import { Button } from '../ui/Button';

type Props = {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
  onAction?: (msg: string) => void;
};

export function CloudControlPlaneModal({ open, onClose, onConnected, onAction }: Props) {
  const [status, setStatus] = useState<SetupCloudStatus | null>(null);
  const [url, setUrl] = useState('https://mastyff-ai-cloud.vercel.app');
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [strictness, setStrictness] = useState(85);
  const [keyRotation, setKeyRotation] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetchSetupCloudStatus().then((s) => {
      setStatus(s);
      if (s?.controlPlaneUrl) setUrl(s.controlPlaneUrl);
      if (s?.ssoEnabled != null) setSsoEnabled(s.ssoEnabled);
      if (s?.policyStrictnessPct != null) setStrictness(s.policyStrictnessPct);
      if (s?.apiKeyRotationEnabled != null) setKeyRotation(s.apiKeyRotationEnabled);
    });
  }, [open]);

  if (!open) return null;

  const onConfirm = async () => {
    setBusy(true);
    const res = await connectSetupCloud({
      controlPlaneUrl: url,
      ssoEnabled,
      policyStrictnessPct: strictness,
      apiKeyRotationEnabled: keyRotation,
    });
    setBusy(false);
    if (res.ok) {
      onAction?.('Cloud control plane connected');
      onConnected();
      onClose();
      if (res.launchUrl) {
        window.open(res.launchUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      onAction?.(res.error || 'Connection failed');
    }
  };

  return (
    <div className="setup-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="setup-modal cloud-control-plane-modal"
        role="dialog"
        aria-labelledby="cloud-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="setup-modal-head">
          <Cloud size={20} aria-hidden />
          <h2 id="cloud-modal-title">Cloud Control Plane</h2>
        </header>

        <label className="setup-toggle-row">
          <span>
            <strong>Single Sign-On (SSO)</strong>
            <span className="hint">SAML 2.0 / OIDC integration</span>
          </span>
          <input
            type="checkbox"
            checked={ssoEnabled}
            onChange={(e) => setSsoEnabled(e.target.checked)}
            aria-label="Enable SSO"
          />
        </label>

        <div className="setup-slider-row">
          <div>
            <strong>Policy Controls</strong>
            <span className="hint">Rate limiting &amp; access rules</span>
          </div>
          <label>
            Strictness {strictness}%
            <input
              type="range"
              min={0}
              max={100}
              value={strictness}
              onChange={(e) => setStrictness(parseInt(e.target.value, 10))}
            />
          </label>
        </div>

        <label className="setup-toggle-row">
          <span>
            <strong>API Key Rotation</strong>
            <span className="hint">Auto-rotate org-level keys</span>
          </span>
          <input
            type="checkbox"
            checked={keyRotation}
            onChange={(e) => setKeyRotation(e.target.checked)}
            aria-label="Enable API key rotation"
          />
        </label>

        <label className="setup-field">
          Control plane URL
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>

        {status?.connected ? <p className="setup-badge">Already linked to cloud</p> : null}

        <footer className="setup-modal-foot">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onConfirm()} disabled={busy}>
            Confirm Connection
          </Button>
        </footer>
      </div>
    </div>
  );
}
