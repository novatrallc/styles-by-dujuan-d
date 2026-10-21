'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight, EyeOff, ShieldCheck, X } from 'lucide-react';

type Operation = 'deactivate' | 'delete';

type Props = {
  serviceName: string;
  operation: Operation;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Accessible, branded replacement for window.confirm in owner service management. */
export function ServiceActionDialog({ serviceName, operation, onCancel, onConfirm }: Props) {
  const isDelete = operation === 'delete';
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="service-action-title"
        aria-describedby="service-action-description"
        className="relative my-auto w-full max-w-[520px] overflow-hidden rounded-[26px] border border-[#947347]/60 bg-[#141315] p-6 text-[#f7f0e5] shadow-[0_30px_110px_#000c,0_0_70px_#b68a3520] sm:p-9"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#e4c188] to-transparent" />
        <button
          type="button"
          aria-label="Close confirmation"
          onClick={onCancel}
          className="absolute right-5 top-5 rounded-full border border-white/10 p-2 text-white/50 transition hover:border-[#d9b77d]/50 hover:text-white"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <span className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d9b77d]/35 bg-[#d9b77d]/10 text-[#e6c88c]">
          {isDelete ? <AlertTriangle size={27} strokeWidth={1.6} aria-hidden="true" /> : <EyeOff size={27} strokeWidth={1.6} aria-hidden="true" />}
        </span>

        <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-[#d9b77d]">
          {isDelete ? 'Permanent removal' : 'Service availability'}
        </p>
        <h2 id="service-action-title" className="display mt-3 text-3xl leading-tight sm:text-4xl">
          {isDelete ? 'Delete this service?' : 'Deactivate this service?'}
        </h2>
        <p className="mt-4 text-sm text-white/55">You are making a change to</p>
        <p className="mt-1 text-lg font-semibold text-[#f1d5a2]">{serviceName}</p>

        <div id="service-action-description" className="mt-6 rounded-2xl border border-[#665139]/60 bg-[#0c0c0e] p-5">
          {isDelete ? (
            <>
              <p className="text-sm font-semibold text-[#f1c4b8]">This action cannot be undone.</p>
              <p className="mt-2 text-sm leading-6 text-white/65">Permanent deletion is allowed only in the local sandbox, for an inactive service with no appointment history. The server will reject deletion if these conditions are not met.</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#e9d19f]">
                <ShieldCheck size={17} aria-hidden="true" /> Your records stay protected
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">This service will no longer be offered for new bookings. Existing appointments and payment history remain saved. You can reactivate it whenever you are ready.</p>
            </>
          )}
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-[#806b4c] px-5 text-sm font-semibold text-[#f7f0e5] transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b77d]"
          >
            Keep service
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b77d] ${isDelete ? 'bg-[#8d413b] text-white hover:bg-[#a44f47]' : 'bg-gradient-to-r from-[#efdaa6] to-[#c79a51] text-[#16100a] hover:brightness-110'}`}
          >
            {isDelete ? 'Delete permanently' : 'Deactivate service'}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-5 text-center text-[11px] text-white/35">Owner-only service management · Styles by Dujuan D</p>
      </div>
    </div>
  );
}
