import type { Metadata } from 'next';
import { ConfirmationStatus } from './status';
export const metadata:Metadata={title:'Reservation status | Styles by Dujuan D',robots:{index:false,follow:false}};
export default function ConfirmationPage(){return <section className="section-space"><div className="site-container mx-auto max-w-3xl px-6 py-16"><p className="eyebrow">YOUR SIGNATURE APPOINTMENT</p><h1 className="display mt-4 text-4xl md:text-5xl">Reservation status</h1><ConfirmationStatus/></div></section>}
