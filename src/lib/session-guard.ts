export type SessionTicket = Readonly<{ uid: string; generation: number }>;
/** UID alone cannot distinguish a previous login to the same account. */
export function createSessionGuard() {
  let uid: string | null = null;
  let generation = 0;
  let paused = false;
  const matches = (ticket: SessionTicket | null) => !!ticket && ticket.uid === uid && ticket.generation === generation;
  return {
    switchUser(next: string | null) {
      if (uid !== next) { uid = next; generation++; paused = false; }
    },
    capture(account: string): SessionTicket | null {
      return !paused && uid === account ? { uid: account, generation } : null;
    },
    active(ticket: SessionTicket | null) { return !paused && matches(ticket); },
    matches,
    pause(account: string): SessionTicket | null {
      if (paused || uid !== account) return null;
      paused = true;
      return { uid: account, generation: ++generation };
    },
    resume(ticket: SessionTicket) {
      if (matches(ticket)) { paused = false; generation++; }
    },
    invalidate() { generation++; },
    isPaused() { return paused; },
  };
}
