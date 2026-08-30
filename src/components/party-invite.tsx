"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function PartyInvite({ code, partyName }: { code: string; partyName: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const joinUrl = () => `${window.location.origin}/join?code=${code}`;

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/join?code=${code}`, { width: 220, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  async function share() {
    const url = joinUrl();
    const data = {
      title: `Join ${partyName} on GymPlanner`,
      text: `Join my training party "${partyName}" — code ${code}`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-xs uppercase text-text-muted">Invite code</div>
      <div className="mt-1 font-mono text-2xl tracking-widest">{code}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={share}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg"
        >
          {copied ? "Link copied" : "Share invite"}
        </button>
        <button
          onClick={() => setShowQr((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          {showQr ? "Hide QR" : "Show QR"}
        </button>
      </div>

      {showQr && qr && (
        <div className="mt-3 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code to join ${partyName}`} width={220} height={220} className="rounded-lg" />
          <p className="text-xs text-text-muted">
            Point a phone camera at this to open the join link.
          </p>
        </div>
      )}

      <p className="mt-2 text-xs text-text-muted">
        Others can also enter the code from the Parties tab.
      </p>
    </div>
  );
}
