import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  type SessionActivity,
  updateSessionActivity,
  getIdleMs,
  isSessionIdle,
} from "./activity.js";

describe("SessionActivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("updateSessionActivity", () => {
    it("sets activity on session with correct timestamp and type", () => {
      const session: { activity?: SessionActivity } = {};
      const now = Date.now();

      updateSessionActivity(session, "agent");

      expect(session.activity).toBeDefined();
      expect(session.activity?.lastActivityAt).toBe(now);
      expect(session.activity?.lastActivityType).toBe("agent");
    });

    it("updates activity with message type", () => {
      const session: { activity?: SessionActivity } = {};

      updateSessionActivity(session, "message");

      expect(session.activity?.lastActivityType).toBe("message");
    });

    it("updates activity with tool type", () => {
      const session: { activity?: SessionActivity } = {};

      updateSessionActivity(session, "tool");

      expect(session.activity?.lastActivityType).toBe("tool");
    });

    it("overwrites previous activity", () => {
      const session: { activity?: SessionActivity } = {
        activity: {
          lastActivityAt: Date.now() - 1000,
          lastActivityType: "message",
        },
      };

      vi.advanceTimersByTime(5000);
      updateSessionActivity(session, "agent");

      expect(session.activity?.lastActivityType).toBe("agent");
      expect(session.activity?.lastActivityAt).toBe(Date.now());
    });
  });

  describe("getIdleMs", () => {
    it("returns 0 for session with no activity", () => {
      const session: { activity?: SessionActivity } = {};

      expect(getIdleMs(session)).toBe(0);
    });

    it("returns correct idle duration", () => {
      const session: { activity?: SessionActivity } = {};

      updateSessionActivity(session, "message");
      vi.advanceTimersByTime(5000);

      expect(getIdleMs(session)).toBe(5000);
    });

    it("returns 0 immediately after activity update", () => {
      const session: { activity?: SessionActivity } = {};

      updateSessionActivity(session, "agent");

      expect(getIdleMs(session)).toBe(0);
    });
  });

  describe("isSessionIdle", () => {
    it("returns false for session with no activity", () => {
      const session: { activity?: SessionActivity } = {};

      expect(isSessionIdle(session, 1000)).toBe(false);
    });

    it("returns false when session has been active within threshold", () => {
      const session: { activity?: SessionActivity } = {};

      updateSessionActivity(session, "message");
      vi.advanceTimersByTime(500);

      expect(isSessionIdle(session, 1000)).toBe(false);
    });

    it("returns true when session exceeds idle threshold", () => {
      const session: { activity?: SessionActivity } = {};

      updateSessionActivity(session, "message");
      vi.advanceTimersByTime(1500);

      expect(isSessionIdle(session, 1000)).toBe(true);
    });

    it("returns true when session exactly at threshold", () => {
      const session: { activity?: SessionActivity } = {};

      updateSessionActivity(session, "agent");
      vi.advanceTimersByTime(1000);

      expect(isSessionIdle(session, 1000)).toBe(true);
    });
  });
});
