'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CalendarDays, Check, ChevronDown, Clock3, CreditCard,
  Info, Mail, Phone, RotateCcw, Scissors, ShieldCheck, UserRound,
} from 'lucide-react';
import { services } from '@/lib/business';

type Slot = { start: string; end: string };
type Customer = { name: string; email: string; phone: string };
const TZ = 'America/New_York';
const baseInput = 'w-full min-h-12 rounded-xl border border-white/20 bg-black/40 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-[#d9b77d] focus:ring-2 focus:ring-[#d9b77d]/20 disabled:opacity-50';
const inputIcon = 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#d9b77d]';
const timeLabel = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const dayLabel = (day: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${day}T12:00:00Z`));
};
const todayEastern = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function BookingForm() {
  const [service, setService] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [chosen, setChosen] = useState('');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [customer, setCustomer] = useState<Customer>({ name: '', email: '', phone: '' });
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const requestId = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const [today] = useState(todayEastern);

  useEffect(() => {
    let active = true;
    fetch('/api/checkout/readiness', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('Readiness unavailable'); return r.json(); })
      .then(data => { if (active) setCheckoutEnabled(data.enabled === true); })
      .catch(() => { if (active) setCheckoutEnabled(false); });
    return () => { active = false; requestController.current?.abort(); };
  }, []);

  async function load(nextService: string, nextDate: string) {
    requestController.current?.abort();
    const id = ++requestId.current;
    setService(nextService);
    setDate(nextDate);
    setChosen('');
    setSlots([]);
    setCheckoutMessage('');
    setAvailabilityMessage('');
    if (!nextService || !nextDate) { setBusy(false); return; }
    const controller = new AbortController();
    requestController.current = controller;
    setBusy(true);
    try {
      const response = await fetch(`/api/availability?service=${encodeURIComponent(nextService)}&date=${encodeURIComponent(nextDate)}`, { cache: 'no-store', signal: controller.signal });
      const result: { slots?: Slot[]; reason?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to check availability.');
      if (id !== requestId.current) return;
      const validSlots = Array.isArray(result.slots) ? result.slots.filter(s => typeof s?.start === 'string' && typeof s?.end === 'string') : [];
      setSlots(validSlots);
      setAvailabilityMessage(result.reason ?? (validSlots.length ? 'Select an available time below.' : 'No available times for this date. Try another day.'));
    } catch (error) {
      if (controller.signal.aborted || id !== requestId.current) return;
      setAvailabilityMessage(error instanceof Error ? error.message : 'Unable to load availability. Please try again.');
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  const selected = slots.find(slot => slot.start === chosen);
  const selectedService = services.find(item => item.slug === service);
  const nameValid = customer.name.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim());
  const phoneValid = customer.phone.replace(/\D/g, '').length >= 7;
  const detailsValid = nameValid && emailValid && phoneValid;
  const canCheckout = checkoutEnabled && !!selected && detailsValid && policyAccepted && !submitting && !busy;

  async function checkout() {
    if (!canCheckout || !selected) return;
    setSubmitting(true);
    setCheckoutMessage('Preparing secure checkout…');
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, start: selected.start, end: selected.end, customer: {
          name: customer.name.trim(), email: customer.email.trim(), phone: customer.phone.trim(),
        } }),
      });
      const result: { checkoutUrl?: string; error?: string } = await response.json();
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || 'Checkout unavailable.');
      const destination = new URL(result.checkoutUrl);
      if (destination.protocol !== 'https:' || destination.hostname !== 'checkout.stripe.com') throw new Error('Unexpected payment destination.');
      window.location.assign(destination.toString());
    } catch (error) {
      setCheckoutMessage(error instanceof Error ? error.message : 'Checkout unavailable.');
      setSubmitting(false);
    }
  }

  return (
    <div className="luxe-card mt-10 overflow-hidden p-5 sm:p-7 md:p-9">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-6">
        <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#d9b77d]">The signature reservation</p><h2 className="display mt-2 text-2xl text-white sm:text-3xl">Your time. Your style.</h2></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d9b77d]/30 bg-[#d9b77d]/10 px-3 py-2 text-xs text-[#e8cf9b]"><ShieldCheck size={15} aria-hidden="true" /> Secure reservation</span>
      </div>

      <section aria-labelledby="booking-choose" className="space-y-5">
        <h3 id="booking-choose" className="display text-xl text-white">01 · Choose your appointment</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm text-white/80">Service <span className="text-[#d9b77d]">*</span>
            <span className="relative mt-2 block"><Scissors size={18} className={inputIcon} aria-hidden="true" />
              <select className={`${baseInput} appearance-none pr-11`} value={service} onChange={e => void load(e.target.value, date)} required>
                <option value="">Choose a service</option>{services.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
              </select><ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/50" aria-hidden="true" />
            </span>
          </label>
          <label className="block text-sm text-white/80">Date <span className="text-[#d9b77d]">*</span>
            <span className="relative mt-2 block"><CalendarDays size={18} className={inputIcon} aria-hidden="true" />
              <input type="date" className={`${baseInput} [color-scheme:dark]`} value={date} min={today} onChange={e => void load(service, e.target.value)} required />
            </span>
          </label>
        </div>
      </section>

      <section aria-labelledby="booking-times" className="mt-9 border-t border-white/10 pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="booking-times" className="display flex items-center gap-3 text-xl text-white"><Clock3 size={20} className="text-[#d9b77d]" aria-hidden="true" /> 02 · Available times</h3>{service && date && <button type="button" disabled={busy} onClick={() => void load(service, date)} className="inline-flex items-center gap-2 text-xs text-[#e8cf9b] underline-offset-4 hover:underline disabled:opacity-50"><RotateCcw size={14} aria-hidden="true" /> Refresh</button>}</div>
        <p className="mt-2 text-sm text-white/55">All times shown in Eastern Time (Columbus, Ohio).</p>
        <p role="status" aria-live="polite" className="mt-4 text-sm text-[#e8cf9b]">{busy ? 'Checking availability…' : availabilityMessage || 'Choose a service and date to see available times.'}</p>
        {!busy && slots.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{slots.map(slot => <button type="button" key={slot.start} aria-pressed={chosen === slot.start} onClick={() => { setChosen(slot.start); setCheckoutMessage(''); }} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b77d] ${chosen === slot.start ? 'border-[#d9b77d] bg-[#d9b77d] text-black' : 'border-white/20 bg-white/[.03] text-white hover:border-[#d9b77d] hover:bg-[#d9b77d]/10'}`}>{chosen === slot.start && <Check size={16} aria-hidden="true" />}{timeLabel(slot.start)}</button>)}</div>}
      </section>

      <section aria-labelledby="booking-details" className="mt-9 border-t border-white/10 pt-7">
        <h3 id="booking-details" className="display text-xl text-white">03 · Your details</h3>
        <p className="mt-2 text-sm text-white/55">We&apos;ll use these details for your reservation.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {([['name', 'Full name', 'Full name', UserRound, 'text', 'name'], ['email', 'Email address', 'Email address', Mail, 'email', 'email'], ['phone', 'Phone number', 'Phone number', Phone, 'tel', 'tel']] as const).map(([key, label, placeholder, Icon, type, autoComplete]) => <label key={key} className="block text-sm text-white/80">{label} <span className="text-[#d9b77d]">*</span><span className="relative mt-2 block"><Icon size={18} className={inputIcon} aria-hidden="true" /><input className={baseInput} type={type} autoComplete={autoComplete} placeholder={placeholder} value={customer[key]} onChange={e => { setCustomer(previous => ({ ...previous, [key]: e.target.value })); setCheckoutMessage(''); }} required maxLength={key === 'name' ? 120 : key === 'email' ? 254 : 30} /></span></label>)}
        </div>
        {(customer.email && !emailValid || customer.phone && !phoneValid) && <p className="mt-3 text-xs text-[#e8cf9b]" role="status">Enter a valid email address and a phone number with at least 7 digits.</p>}
      </section>

      <section aria-labelledby="booking-review" className="mt-9 border-t border-white/10 pt-7">
        <h3 id="booking-review" className="display text-xl text-white">04 · Review & reserve</h3>
        <div className="mt-5 rounded-2xl border border-[#d9b77d]/25 bg-[#d9b77d]/[.06] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#d9b77d]">Appointment summary</p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><span className="block text-white/50">Service</span><strong className="mt-1 block font-medium text-white">{selectedService?.name ?? 'Not selected'}</strong></div>
            <div><span className="block text-white/50">Date & time</span><strong className="mt-1 block font-medium text-white">{date ? dayLabel(date) : 'Not selected'}{selected ? ` · ${timeLabel(selected.start)}` : ''}</strong></div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#d9b77d]/20 pt-4"><span className="text-sm text-white/70">Reservation fee due at checkout</span><strong className="display text-2xl text-[#e8cf9b]">$10.00</strong></div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/60"><Info size={16} className="mt-0.5 shrink-0 text-[#d9b77d]" aria-hidden="true" /> The $10 fee is non-refundable and credited toward your service. Remaining balance is paid in person. Rescheduling requires at least 24 hours&apos; notice.</p>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-white/75"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#d9b77d]" checked={policyAccepted} onChange={e => setPolicyAccepted(e.target.checked)} /> <span>I understand and agree to the reservation fee and 24-hour rescheduling policy.</span></label>
        {!checkoutEnabled && <p className="mt-5 rounded-xl border border-white/15 bg-white/[.04] px-4 py-3 text-sm text-white/65"><ShieldCheck size={16} className="mr-2 inline text-[#d9b77d]" aria-hidden="true" /> Secure checkout is not yet open. You can explore availability, but reservations cannot be confirmed.</p>}
        {checkoutMessage && <p role="status" aria-live="polite" className="mt-4 text-sm text-[#e8cf9b]">{checkoutMessage}</p>}
        <button type="button" disabled={!canCheckout} onClick={() => void checkout()} className="button-gold mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 text-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><CreditCard size={18} aria-hidden="true" />{submitting ? 'Opening secure checkout…' : checkoutEnabled ? 'Continue to secure $10 checkout' : 'Secure checkout — coming soon'}<ArrowRight size={17} aria-hidden="true" /></button>
        <p className="mt-3 text-xs leading-5 text-white/45">Your appointment is confirmed only after payment is verified by the server. A checkout redirect alone does not confirm a reservation.</p>
      </section>
    </div>
  );
}
