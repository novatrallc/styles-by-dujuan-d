"use client";
import type { ComponentType, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
type IconType=ComponentType<{size?:number;className?:string;"aria-hidden"?:boolean}>;
type Base={label:string;icon:IconType;hint?:string;error?:string;children?:ReactNode};
export function PremiumField({label,icon:Icon,hint,error,children}:Base){return <div className="premium-field"><label className="premium-field-label">{label}</label><div className={`premium-input-shell${error?' premium-input-error':''}`}><Icon size={18} className="premium-input-icon" aria-hidden={true}/>{children}</div>{error?<p className="premium-field-error" role="alert"><AlertCircle size={14}/>{error}</p>:hint?<p className="premium-field-hint">{hint}</p>:null}</div>}
export function PremiumInput({label,icon, ...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'children'> & {label:string;icon:IconType}){return <PremiumField label={label} icon={icon}><input aria-label={label} {...props}/></PremiumField>}
export function PremiumSelect({label,icon,children,...props}:SelectHTMLAttributes<HTMLSelectElement> & {label:string;icon:IconType}){return <PremiumField label={label} icon={icon}><select aria-label={label} {...props}>{children}</select></PremiumField>}
