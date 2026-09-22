import React, { useEffect, useState } from 'react';
import { CheckCircle2, Mail, RefreshCw, ShieldCheck, X } from 'lucide-react';

interface EmailVerificationModalProps {
  email: string;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}

const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  email,
  onClose,
  onVerify,
  onResend,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onVerify(code);
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      await onResend();
      setMessage('A new verification code was sent.');
      setCooldown(60);
    } catch (err: any) {
      setError(err?.message || 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-10 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
          aria-label="Close verification"
        >
          <X size={20} />
        </button>

        <div className="bg-[#57068c] px-8 pb-12 pt-11 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <ShieldCheck size={34} />
          </div>
          <h2 className="text-3xl font-extrabold">Verify your NYU email</h2>
          <p className="mt-2 text-sm text-purple-100">We sent a 6-digit code to</p>
          <p className="mt-1 font-bold">{email}</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-5 px-8 py-8">
          <div>
            <label className="mb-2 block text-center text-xs font-bold uppercase tracking-wider text-gray-600">
              Verification code
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-4 pl-12 pr-4 text-center text-2xl font-bold tracking-[0.45em] outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#57068c]"
              />
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          {message && (
            <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 size={16} /> {message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full rounded-xl bg-[#57068c] py-4 text-lg font-bold text-white shadow-lg transition hover:bg-[#450470] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? 'Verifying…' : 'Verify email'}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-[#57068c] disabled:text-gray-400"
          >
            <RefreshCw size={16} className={resending ? 'animate-spin' : ''} />
            {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmailVerificationModal;
