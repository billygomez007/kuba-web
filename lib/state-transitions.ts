/**
 * Generic, dependency-free state-transition assertion shared by every
 * centralized state machine in the app (appointments/tickets in
 * lib/customer-operations.ts, campaign/recipient states in
 * lib/outreach/*-state.ts). Deliberately has no other imports so a module
 * that only needs transition validation never has to pull in @/db.
 */
export function assertTransition<T extends string>(transitions: Record<T, T[]>, current: T, next: T) {
  if (!transitions[current]?.includes(next)) throw new Error(`Cannot change status from ${current} to ${next}.`);
}
