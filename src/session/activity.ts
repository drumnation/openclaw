/**
 * Session Activity Tracking
 *
 * Tracks the last activity timestamp for sessions, enabling idle detection
 * and time-based lifecycle hooks.
 */

/**
 * Activity metadata stored on session entries.
 */
export interface SessionActivity {
  /** Unix timestamp (ms) of last meaningful activity */
  lastActivityAt: number;
  /** Type of activity that triggered the update */
  lastActivityType: "message" | "agent" | "tool";
}

/**
 * Update the activity timestamp on a session entry.
 * Mutates the session object in place.
 */
export function updateSessionActivity(
  session: { activity?: SessionActivity },
  type: SessionActivity["lastActivityType"],
): void {
  session.activity = {
    lastActivityAt: Date.now(),
    lastActivityType: type,
  };
}

/**
 * Get the time in milliseconds since the last activity on a session.
 * Returns 0 if no activity has been recorded.
 */
export function getIdleMs(session: { activity?: SessionActivity }): number {
  const lastActivityAt = session.activity?.lastActivityAt;
  if (lastActivityAt === undefined) {
    return 0;
  }
  return Date.now() - lastActivityAt;
}

/**
 * Check if a session has been idle for at least the given threshold.
 * Returns false if no activity has been recorded (session is considered new, not idle).
 */
export function isSessionIdle(
  session: { activity?: SessionActivity },
  thresholdMs: number,
): boolean {
  const lastActivityAt = session.activity?.lastActivityAt;
  if (lastActivityAt === undefined) {
    return false;
  }
  return getIdleMs(session) >= thresholdMs;
}
