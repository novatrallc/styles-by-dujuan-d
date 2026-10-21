"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "Our Story" },
  { href: "/contact", label: "Contact" },
];

/** Branded site navigation. Booking behavior and route access are unchanged. */
export function Header() {
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

  return (
    <header className="relative z-40 border-b border-[#b68a4d]/25 bg-[#08090a]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c69d60]/40 to-transparent" />
      <nav
        aria-label="Main navigation"
        className="section-wrap flex min-h-[86px] items-center justify-between gap-4 py-2 sm:min-h-[92px]"
      >
        <Link
          href="/"
          onClick={closeMenu}
          aria-label="Styles by Dujuan D — home"
          className="group relative flex shrink-0 items-center focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b77d]"
        >
          <Image
            src="/brand/dujuan-header-logo.webp"
            alt="Styles by Dujuan D"
            width={925}
            height={331}
            priority
            sizes="(max-width: 640px) 172px, 230px"
            className="h-auto w-[172px] select-none mix-blend-screen transition-opacity duration-300 group-hover:opacity-90 sm:w-[208px] lg:w-[230px]"
          />
        </Link>

        <div className="hidden items-center gap-7 text-sm text-[#f3eee6]/85 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors duration-200 hover:text-[#e8c88e] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9b77d]"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/book" className="button-gold whitespace-nowrap">
            Book Appointment <span aria-hidden="true" className="ml-1">↗</span>
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-controls="mobile-navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-[#d9b77d]/40 bg-[#d9b77d]/5 p-3 text-[#d9b77d] transition-colors hover:bg-[#d9b77d]/10 md:hidden"
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </nav>

      {open && (
        <div
          id="mobile-navigation"
          className="section-wrap flex flex-col gap-1 border-t border-[#d9b77d]/15 bg-[#090a0c] pb-6 pt-4 md:hidden"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="rounded-lg px-3 py-3 text-[#f6f0e7]/90 transition-colors hover:bg-white/10 hover:text-[#e8c88e]"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/book" onClick={closeMenu} className="button-gold mt-3 text-center">
            Book Appointment ↗
          </Link>
        </div>
      )}
    </header>
  );
}
