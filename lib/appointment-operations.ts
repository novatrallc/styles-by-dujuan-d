export type AppointmentStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'expired' | 'completed' | 'no_show';
export type OwnerAction = 'cancel' | 'complete' | 'no_show';
export function canChangeAppointment(status: AppointmentStatus, action: OwnerAction, startMs: number, nowMs = Date.now()): boolean {
  if (action === 'cancel') return status === 'confirmed' || status === 'pending_payment';
  if (action === 'complete' || action === 'no_show') return status === 'confirmed' && Number.isFinite(startMs) && startMs <= nowMs;
  return false;
}
export const targetStatus: Record<OwnerAction, AppointmentStatus> = { cancel: 'cancelled', complete: 'completed', no_show: 'no_show' };
