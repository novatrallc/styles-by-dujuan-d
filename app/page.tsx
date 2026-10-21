import Image from "next/image";
import Link from "next/link";
import { getPublicServices, formatServicePrice } from "@/lib/public-service-catalog";

export const dynamic = 'force-dynamic';
export default async function Home() {
  const { services, pricesEnabled } = await getPublicServices();
  return (
    <>
      {/* HERO: generous, responsive vertical rhythm and brand-first editorial layout. */}
      <section className="relative isolate overflow-hidden border-b border-[#d9b77d]/15 bg-[#09090b]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_32%,#3e2b1b_0%,#17120f_31%,#09090b_68%)]" />
        <div className="pointer-events-none absolute -left-28 top-12 h-72 w-72 rounded-full bg-[#ab773b]/10 blur-3xl" />
        <div className="section-wrap relative grid items-center gap-14 py-24 sm:gap-16 sm:py-28 lg:min-h-[690px] lg:grid-cols-[.9fr_1.1fr] lg:gap-20 lg:py-32 xl:py-36">
          <div className="relative z-10 max-w-xl">
            <div className="mb-7 flex items-center gap-3">
              <span className="h-px w-9 bg-[#d6aa6b]" aria-hidden="true" />
              <p className="gold text-[10px] font-semibold uppercase tracking-[.30em] sm:text-xs">
                Signature barbering · Individual style
              </p>
            </div>
            <h1 className="display text-[clamp(3.25rem,6vw,5.5rem)] leading-[1.04] tracking-[-.025em] text-[#f7f2eb]">
              Your look.
              <br />
              <span className="gold italic">Your signature.</span>
            </h1>
            <p className="mt-7 max-w-md text-base leading-8 text-[#e8e1d8]/70 sm:text-lg">
              Every fingerprint is unique. Your style should be, too. Discover
              thoughtful barbering and grooming designed around you.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/book"
                className="button-gold shadow-[0_10px_38px_#bd8c4345] transition-transform duration-300 hover:-translate-y-0.5"
              >
                Book Appointment <span aria-hidden="true" className="ml-2">↗</span>
              </Link>
              <Link href="/services" className="button-outline">
                Explore Services
              </Link>
            </div>
            <p className="mt-6 max-w-md text-xs leading-6 text-white/45">
              Online booking coming soon · $10 reservation fee credited toward your service
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[690px] lg:mx-0">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 border-r border-t border-[#cf9d5f]/65 sm:-right-5 sm:-top-5"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 -left-3 h-24 w-24 border-b border-l border-[#cf9d5f]/65 sm:-bottom-5 sm:-left-5"
            />
            <figure className="group relative aspect-[5/4] overflow-hidden rounded-[1.6rem] border border-[#d9b77d]/30 bg-[#171411] shadow-[0_35px_90px_#000a,0_0_65px_#9f712122] sm:aspect-[6/5]">
              <Image
                src="/brand/dujuan-studio.jpeg"
                alt="Luxury barber studio interior with black and gold barber chairs, illuminated mirrors, and marble counters"
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 54vw"
                className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.035]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060607]/85 via-transparent to-[#060607]/10" />
              <figcaption className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4 px-6 pb-6 sm:px-8 sm:pb-8">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-[.32em] text-[#e5c28a]">
                    The experience
                  </span>
                  <span className="display mt-2 block text-xl text-[#fff8ee] sm:text-2xl">
                    Refined in every detail.
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e4c28c]/60 text-xl text-[#e4c28c] sm:flex"
                >
                  ✦
                </span>
              </figcaption>
            </figure>
            <p className="mt-5 text-right text-[10px] font-semibold uppercase tracking-[.27em] text-[#d9b77d]/65">
              Styles by Dujuan D · Look good. Feel better. Be you.
            </p>
          </div>
        </div>
      </section>

      {/* SERVICE PREVIEW: breathing room between heading, cards and section edges. */}
      <section className="section-wrap py-24 sm:py-32 lg:py-40">
        <div className="flex flex-wrap items-end justify-between gap-7 sm:gap-10">
          <div>
            <p className="gold text-xs font-semibold uppercase tracking-[.30em]">The experience</p>
            <h2 className="display mt-3 text-4xl md:text-5xl">
              Crafted for <em>your</em> look.
            </h2>
          </div>
          <Link href="/services" className="gold text-sm transition-opacity hover:opacity-75">
            View all services →
          </Link>
        </div>
        <div className="mt-12 grid gap-6 sm:mt-14 lg:mt-16 lg:gap-8 md:grid-cols-3">
          {services.slice(0, 3).map((service, index) => (
            <article
              key={service.slug}
              className="luxe-card group relative overflow-hidden p-8 sm:p-9 lg:p-10 transition duration-300 hover:-translate-y-1 hover:border-[#d9b77d]/50 hover:shadow-[0_20px_50px_#0008]"
            >
              <div aria-hidden="true" className="absolute left-0 top-0 h-px w-0 bg-[#d9b77d] transition-all duration-500 group-hover:w-full" />
              <span className="display text-4xl text-[#d9b77d]/45">
                0{index + 1}
              </span>
              <h3 className="display mt-7 text-2xl">{service.name}</h3>
              <p className="mt-5 min-h-20 text-sm leading-7 text-white/55">
                {service.description}
              </p>
              <p className="gold mt-8 border-t border-white/10 pt-6 text-xs uppercase tracking-widest">
                {pricesEnabled ? formatServicePrice(service.priceCents) : "Pricing to be confirmed"}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* EDITORIAL STORY: airy split layout; keeps the existing light-logo brand asset. */}
      <section className="border-y border-[#d9b77d]/20 bg-[#eae0cf] py-24 text-[#17120e] sm:py-32 lg:py-40">
        <div className="section-wrap grid items-center gap-14 sm:gap-16 md:grid-cols-2 lg:gap-24">
          <div>
            <p className="text-xs uppercase tracking-[.3em] text-[#936f3a]">A personal philosophy</p>
            <h2 className="display mt-6 text-4xl leading-tight md:text-5xl">
              Your style is as unique as your fingerprint.
            </h2>
            <p className="mt-7 max-w-lg leading-8 text-black/65">
              An individual approach to every cut, every detail, and every finishing touch.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#c6ab7c]/50 bg-white shadow-[0_18px_50px_#261a1314]">
            <Image
              src="/brand/logo-light.png"
              alt="Styles by Dujuan D logo in gold on a light background"
              width={1920}
              height={768}
              sizes="(max-width: 767px) 100vw, 50vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className="section-wrap py-28 text-center sm:py-36 lg:py-44">
        <div className="mx-auto mb-8 h-px w-16 bg-[#d9b77d]/65" aria-hidden="true" />
        <p className="gold text-xs uppercase tracking-[.3em]">The next appointment</p>
        <h2 className="display mt-6 text-4xl md:text-5xl">A better look starts here.</h2>
        <p className="mx-auto mt-7 max-w-xl leading-8 text-white/60">
          Browse the service menu and get ready to reserve your time. Booking
          will open once the schedule is confirmed.
        </p>
        <Link href="/book" className="button-gold mt-10">
          Booking Information ↗
        </Link>
      </section>
    </>
  );
}
