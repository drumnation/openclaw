/**
 * User identity for webchat — optional avatar and display name.
 * Injected via window globals from gateway config `ui.user`.
 */

export type UserIdentity = {
  name: string;
  avatar: string | null;
};

declare global {
  interface Window {
    __OPENCLAW_USER_AVATAR__?: string;
    __OPENCLAW_USER_NAME__?: string;
  }
}

export function resolveInjectedUserIdentity(): UserIdentity {
  if (typeof window === "undefined") {
    return { name: "You", avatar: null };
  }
  const name = window.__OPENCLAW_USER_NAME__?.trim() || "You";
  const avatar = window.__OPENCLAW_USER_AVATAR__?.trim() || null;
  return { name, avatar };
}
