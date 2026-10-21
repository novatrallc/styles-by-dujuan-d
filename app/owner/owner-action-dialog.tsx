'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, CalendarX2, Clock3, ShieldCheck, X } from 'lucide-react';

type Props = {
  title: string;
  subject: string;
  description: string;
  confirmLabel: string;
  eyebrow: string;
  tone?: 'warning' | 'neutral';
  onCancel: () => void;
  onConfirm: () => void;
};

/** B4.2.2: reusable owner confirmation for appointment/time-off actions. */
export function OwnerActionDialog({ title, subject, description, confirmLabel, eyebrow, tone = 'warning', onCancel, onConfirm }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const currentCancel = useRef(onCancel);
  useEffect(() => { currentCancel.current = onCancel; }, [onCancel]);
  useEffect(() => {
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButton.current?.focus();
    function keys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        currentCancel.current();
      }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        event.preventDefault();
        buttons[0].focus();
      }
    }
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('keydown', keys); prior?.focus(); };
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div ref={root} role="alertdialog" aria-modal="true" aria-labelledby="owner-action-title" aria-describedby="owner-action-description"
        className="relative my-auto w-full max-w-[520px] overflow-hidden rounded-[26px] border border-[#947347]/60 bg-[#141315] p-6 text-[#f7f0e5] shadow-[0_30px_110px_#000c,0_0_70px_#b68a3520] sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#e4c188] to-transparent" />
        <button type="button" aria-label="Close confirmation" onClick={onCancel}
          className="absolute right-5 top-5 rounded-full border border-white/10 p-2 text-white/50 transition hover:border-[#d9b77d]/50 hover:text-white">
          <X size={18} aria-hidden="true" />
        </button>
        <span className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d9b77d]/35 bg-[#d9b77d]/10 text-[#e6c88c]">
          {tone === 'warning' ? <AlertTriangle size={27} strokeWidth={1.6} aria-hidden="true" /> : <Clock3 size={27} strokeWidth={1.6} aria-hidden="true" />}
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-[#d9b77d]">{eyebrow}</p>
        <h2 id="owner-action-title" className="display mt-3 text-3xl leading-tight sm:text-4xl">{title}</h2>
        <p className="mt-4 text-sm text-white/55">You are making a change to</p>
        <p className="mt-1 text-lg font-semibold text-[#f1d5a2]">{subject}</p>
        <div id="owner-action-description" className="mt-6 rounded-2xl border border-[#665139]/60 bg-[#0c0c0e] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#e9d19f]">
            {tone === 'warning' ? <CalendarX2 size={17} aria-hidden="true" /> : <ShieldCheck size={17} aria-hidden="true" />}
            Review before continuing
          </div>
          <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
        </div>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
          <button ref={cancelButton} type="button" onClick={onCancel}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-[#806b4c] px-5 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b77d]">
            Keep unchanged
          </button>
          <button type="button" onClick={onConfirm}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#efdaa6] to-[#c79a51] px-5 text-sm font-semibold text-[#16100a] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b77d]">
            {confirmLabel}
          </button>
        </div>
        <p className="mt-5 text-center text-[11px] text-white/35">Private owner operations · Styles by Dujuan D</p>
      </div>
    </div>
  );
}
