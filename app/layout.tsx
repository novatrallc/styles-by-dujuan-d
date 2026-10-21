import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
export const metadata: Metadata = { title: "Styles by Dujuan D | Signature Barbering & Grooming", description: "Your style is your signature. Explore premium barbering, hair styling and grooming at Styles by Dujuan D." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body><a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-black focus:p-3">Skip to content</a><Header /><main id="main-content">{children}</main><Footer /></body></html>; }
