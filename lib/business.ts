export const business = {
  brand: "STYLES BY DUJUAN D",
  name: "Styles by Dujuan D",
  tagline: "Look good. Feel better. Be you.",
  address: null as string | null, // Await owner confirmation; do not publish conflicting addresses.
  bookingDepositCents: 1000,
  rescheduleNoticeHours: 24,
  currency: "USD",
  timezone: "America/New_York",
  bookingsEnabled: false,
} as const;
export type Service = { slug: string; name: string; description: string; durationMinutes: number | null; priceCents: number | null };
export const services: Service[] = [
  { slug: "beard-trim", name: "Beard Trim Only", description: "Clean lines, careful shaping, and the finishing details.", durationMinutes: null, priceCents: null },
  { slug: "haircut", name: "Signature Haircut", description: "A tailored cut that feels unmistakably yours.", durationMinutes: null, priceCents: null },
  { slug: "haircut-beard", name: "Haircut & Beard Trim", description: "A complete refresh, from the cut to the final line.", durationMinutes: null, priceCents: null },
  { slug: "haircut-shave", name: "Haircut & Shave", description: "A sharp haircut with a smooth, polished finish.", durationMinutes: null, priceCents: null },
  { slug: "shave", name: "Shave Only", description: "A close, clean shave with attention to comfort.", durationMinutes: null, priceCents: null },
  { slug: "color", name: "Color Only", description: "Personalized color to complement your look.", durationMinutes: null, priceCents: null },
  { slug: "cut-color", name: "Cut & Color", description: "A considered transformation, cut and color together.", durationMinutes: null, priceCents: null },
  { slug: "styling", name: "Hair Styling", description: "A distinctive finished look for your next occasion.", durationMinutes: null, priceCents: null },
];
export function canBookService(service: Service): boolean {
  return service.priceCents !== null && service.priceCents >= business.bookingDepositCents && service.durationMinutes !== null && service.durationMinutes > 0;
}
export function remainingBalanceCents(totalCents: number, depositCents = business.bookingDepositCents): number {
  if (!Number.isSafeInteger(totalCents) || !Number.isSafeInteger(depositCents) || totalCents < depositCents || depositCents < 0) throw new Error("Invalid booking amount");
  return totalCents - depositCents;
}
