'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

type Service = { slug: string; name: string; is_active: boolean; price_cents: number | null };
type Slot = { start: string; end: string };
type OwnerResponse = { services?: Service[] };
type AvailabilityResponse = { ready?: boolean; slots?: Slot[]; error?: string; reason?: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnon
  ? createClient(supabaseUrl, supabaseAnon)
  : null;

const fieldClass = 'w-full rounded-lg border border-[#6a5335] bg-[#101012] px-3 py-3 text-white';

function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function slotLabel(start: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  }).format(new Date(start));
}

export default function StripeSandboxLab() {
  const [token, setToken] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState('');
  const [date, setDate] = useState(localDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotStart, setSlotStart] = useState('');
  const [name, setName] = useState('Sandbox Test Customer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setToken(data.session?.access_token ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!token) { setAuthorized(false); setServices([]); return; }
    const controller = new AbortController();
    void (async () => {
      setError('');
      try {
        const response = await fetch('/api/owner', {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Owner authorization failed. Sign in through the owner dashboard.');
        const result = await response.json() as OwnerResponse;
        if (!Array.isArray(result.services)) throw new Error('Service list is unavailable.');
        setServices(result.services.filter(s => s.is_active && (s.price_cents ?? 0) >= 1000));
        setAuthorized(true);
      } catch (e) {
        if (!controller.signal.aborted) { setAuthorized(false); setError(e instanceof Error ? e.message : 'Unable to load owner data.'); }
      }
    })();
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    setSlots([]);
    setSlotStart('');
    if (!authorized || !service || !date) return;
    const controller = new AbortController();
    void (async () => {
      setError('');
      try {
        const query = new URLSearchParams({ date, service });
        const response = await fetch(`/api/owner/stripe-test-availability?${query}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Could not load availability.');
        const result = await response.json() as AvailabilityResponse;
        if (result.ready !== true || !Array.isArray(result.slots)) throw new Error(result.reason || result.error || 'Availability is not ready.');
        const validSlots = result.slots.filter(s => typeof s.start === 'string' && typeof s.end === 'string' && Date.parse(s.start) > Date.now() && Date.parse(s.end) > Date.parse(s.start));
        setSlots(validSlots);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load slots.');
      }
    })();
    return () => controller.abort();
  }, [authorized, service, date, token]);

  async function beginCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !authorized || loading) return;
    const selected = slots.find(s => s.start === slotStart);
    if (!selected) { setError('Select an available appointment time.'); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Your owner session has expired. Please sign in again.');
      const response = await fetch('/api/owner/stripe-test-checkout', {
        method: 'POST', cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, start: selected.start, end: selected.end, customer: { name: name.trim(), email: email.trim(), phone: phone.trim() } }),
      });
      const result = await response.json() as { checkoutUrl?: string; testMode?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || `Checkout request failed (${response.status}).`);
      if (result.testMode !== true || !result.checkoutUrl?.startsWith('https://checkout.stripe.com/')) throw new Error('Unexpected checkout response; navigation blocked.');
      setNotice('Redirecting to Stripe TEST checkout…');
      window.location.assign(result.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create sandbox checkout.');
    } finally { setLoading(false); }
  }

  return <main className="section-wrap section-space" style={{ minHeight: '75vh' }}>
    <Link href="/owner" className="text-[#d9b77d] underline">← Back to Owner Dashboard</Link>
    <p className="mt-8 text-xs font-bold tracking-[.2em] text-[#d9b77d]">OWNER DEVELOPMENT LAB</p>
    <h1 className="display mt-2 text-3xl md:text-5xl">Stripe Sandbox Checkout</h1>
    <p className="mt-3 max-w-2xl text-white/70">Test-only $10 deposit. This page never enables public booking or customer email delivery.</p>
    <div className="mt-6 rounded-xl border border-[#d9b77d]/40 bg-[#d9b77d]/10 p-4 text-sm text-[#f0d9aa]">TEST MODE ONLY · Local Supabase required · Use fictional customer details · Do not enter real card information</div>
    {!supabase && <p role="alert" className="mt-5 text-red-300">Local Supabase client configuration is missing.</p>}
    {supabase && !token && <p className="mt-5">Please <Link href="/owner" className="underline text-[#d9b77d]">sign in as the owner</Link> first.</p>}
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-500/50 p-3 text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-5 text-[#d9b77d]">{notice}</p>}
    {authorized && <form onSubmit={beginCheckout} className="mt-8 grid max-w-xl gap-5 rounded-2xl border border-[#6a5335] bg-[#171719] p-6">
      <label className="grid gap-2">Service
        <select className={fieldClass} value={service} onChange={e => setService(e.target.value)} required>
          <option value="">Choose a service</option>
          {services.map(s => <option key={s.slug} value={s.slug}>{s.name} — ${((s.price_cents ?? 0) / 100).toFixed(2)}</option>)}
        </select>
      </label>
      <label className="grid gap-2">Appointment date (New York time)
        <input className={fieldClass} type="date" min={localDate()} value={date} onChange={e => setDate(e.target.value)} required />
      </label>
      <label className="grid gap-2">Available appointment time
        <select className={fieldClass} value={slotStart} onChange={e => setSlotStart(e.target.value)} required disabled={!slots.length}>
          <option value="">{slots.length ? 'Choose an available time' : 'No available slots for this selection'}</option>
          {slots.map(s => <option key={`${s.start}-${s.end}`} value={s.start}>{slotLabel(s.start)}</option>)}
        </select>
      </label>
      <label className="grid gap-2">Fictional customer name
        <input className={fieldClass} value={name} onChange={e => setName(e.target.value)} minLength={2} required />
      </label>
      <label className="grid gap-2">Test email address
        <input className={fieldClass} type="email" placeholder="test@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
      </label>
      <label className="grid gap-2">Test phone number
        <input className={fieldClass} type="tel" placeholder="6145550100" value={phone} onChange={e => setPhone(e.target.value)} required />
      </label>
      <button className="button-gold" type="submit" disabled={loading || !service || !slotStart || !name.trim() || !email.trim() || !phone.trim()}>
        {loading ? 'Preparing test checkout…' : 'Pay $10 in Stripe TEST mode'}
      </button>
      <p className="text-xs leading-5 text-white/50">The server enforces owner access, a local database, test keys, and available-slot validation. A checkout attempt creates a temporary appointment hold.</p>
    </form>}
  </main>;
}
