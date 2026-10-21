import Link from 'next/link';
import { formatServicePrice, getPublicServices } from '@/lib/public-service-catalog';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Services | Styles by Dujuan D',
  description: 'Explore signature barbering, grooming, styling, and color services at Styles by Dujuan D.',
};

export default async function ServicesPage() {
  const { services, catalogEnabled, pricesEnabled } = await getPublicServices();

  return (
    <section className="section-wrap py-24 sm:py-28 lg:py-36">
      <div className="mb-12 max-w-3xl sm:mb-14">
        <p className="gold text-xs font-semibold uppercase tracking-[.30em]">The service menu</p>
        <h1 className="display mt-5 text-[clamp(2.75rem,5vw,4.5rem)] leading-[1.1]">
          Every detail <em>matters.</em>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-white/60">
          Find the service that fits your style. Every appointment is approached with
          care, precision, and attention to the details that make your look yours.
        </p>
        {!catalogEnabled && (
          <p className="mt-3 text-sm leading-6 text-[#d9b77d]/85">
            Pricing and appointment durations are being finalized; online reservations
            will open when the schedule and secure checkout are ready.
          </p>
        )}
      </div>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-[#d9b77d]/25 bg-[#171719] p-8 sm:p-10">
          <h2 className="display text-2xl">Our next collection is coming soon.</h2>
          <p className="mt-3 text-sm leading-7 text-white/60">No services are currently available for display. Please check back shortly.</p>
          <Link href="/contact" className="gold mt-5 inline-block text-sm hover:underline">Contact the studio →</Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:gap-6">
          {services.map((service, index) => (
            <article key={service.slug} className="group flex min-h-64 flex-col rounded-[1.45rem] border border-[#d9b77d]/15 bg-[linear-gradient(150deg,#1a1919,#0d0e10)] p-7 transition duration-300 hover:-translate-y-0.5 hover:border-[#d9b77d]/40 hover:shadow-[0_15px_45px_#0007] sm:p-9">
              <p className="text-[11px] font-semibold uppercase tracking-[.17em] text-[#c9a66c]">SERVICE {String(index + 1).padStart(2, '0')}</p>
              <h2 className="display mt-5 text-2xl leading-tight sm:text-[1.75rem]">{service.name}</h2>
              <p className="mt-4 flex-1 text-sm leading-7 text-white/60">{service.description}</p>
              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm">
                <span className="font-medium text-[#ddb77c]">
                  {pricesEnabled ? formatServicePrice(service.priceCents) : 'Pricing coming soon'}
                </span>
                <Link href="/book" className="text-white/65 transition hover:text-[#e8c68c]" aria-label={`Booking information for ${service.name}`}>
                  Booking info ↗
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-9 max-w-3xl text-xs leading-6 text-white/40">
        A $10 reservation deposit will be credited toward your service when online booking launches.
        Online payments are not yet enabled.
      </p>
    </section>
  );
}
