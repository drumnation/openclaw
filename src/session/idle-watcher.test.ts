import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearInternalHooks, registerInternalHook } from "../hooks/internal-hooks.js";
import {
  checkIdleSessions,
  createIdleWatcherState,
  resolveIdleWatcherConfig,
  startIdleWatcher,
  stopIdleWatcher,
  type IdleCheckableSession,
  type IdleWatcherConfig,
} from "./idle-watcher.js";

describe("idle-watcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearInternalHooks();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearInternalHooks();
  });

  describe("resolveIdleWatcherConfig", () => {
    it("returns defaults when no config provided", () => {
      const config = resolveIdleWatcherConfig();
      expect(config).toEqual({
        enabled: false,
        checkIntervalMs: 60_000,
        idleThresholdMs: 300_000,
      });
    });

    it("merges provided values with defaults", () => {
      const config = resolveIdleWatcherConfig({
        enabled: true,
        checkIntervalMs: 30_000,
      });
      expect(config).toEqual({
        enabled: true,
        checkIntervalMs: 30_000,
        idleThresholdMs: 300_000,
      });
    });
  });

  describe("createIdleWatcherState", () => {
    it("creates initial state", () => {
      const state = createIdleWatcherState();
      expect(state.intervalHandle).toBeNull();
      expect(state.lastIdleSessions.size).toBe(0);
      expect(state.running).toBe(false);
    });
  });

  describe("checkIdleSessions", () => {
    const config: IdleWatcherConfig = {
      enabled: true,
      checkIntervalMs: 1000,
      idleThresholdMs: 5000,
    };

    it("emits session:idle when session becomes idle", async () => {
      const idleEvents: string[] = [];
      registerInternalHook("session:idle", (event) => {
        idleEvents.push(event.sessionKey);
      });

      const now = Date.now();
      const sessions = new Map<string, IdleCheckableSession>([
        ["session-1", { activity: { lastActivityAt: now - 10000, lastActivityType: "message" } }],
      ]);
      const state = createIdleWatcherState();

      await checkIdleSessions(config, () => sessions, state);

      expect(idleEvents).toEqual(["session-1"]);
      expect(state.lastIdleSessions.has("session-1")).toBe(true);
    });

    it("does not emit idle for already idle sessions", async () => {
      const idleEvents: string[] = [];
      registerInternalHook("session:idle", (event) => {
        idleEvents.push(event.sessionKey);
      });

      const now = Date.now();
      const sessions = new Map<string, IdleCheckableSession>([
        ["session-1", { activity: { lastActivityAt: now - 10000, lastActivityType: "message" } }],
      ]);
      const state = createIdleWatcherState();
      state.lastIdleSessions.add("session-1"); // Already tracked as idle

      await checkIdleSessions(config, () => sessions, state);

      expect(idleEvents).toEqual([]);
    });

    it("emits session:resume when idle session becomes active", async () => {
      const resumeEvents: string[] = [];
      registerInternalHook("session:resume", (event) => {
        resumeEvents.push(event.sessionKey);
      });

      const now = Date.now();
      const sessions = new Map<string, IdleCheckableSession>([
        ["session-1", { activity: { lastActivityAt: now - 1000, lastActivityType: "message" } }], // Active
      ]);
      const state = createIdleWatcherState();
      state.lastIdleSessions.add("session-1"); // Was idle

      await checkIdleSessions(config, () => sessions, state);

      expect(resumeEvents).toEqual(["session-1"]);
      expect(state.lastIdleSessions.has("session-1")).toBe(false);
    });

    it("does not emit resume for already active sessions", async () => {
      const resumeEvents: string[] = [];
      registerInternalHook("session:resume", (event) => {
        resumeEvents.push(event.sessionKey);
      });

      const now = Date.now();
      const sessions = new Map<string, IdleCheckableSession>([
        ["session-1", { activity: { lastActivityAt: now - 1000, lastActivityType: "message" } }],
      ]);
      const state = createIdleWatcherState();
      // Not in lastIdleSessions = was already active

      await checkIdleSessions(config, () => sessions, state);

      expect(resumeEvents).toEqual([]);
    });

    it("handles sessions without activity (new sessions)", async () => {
      const idleEvents: string[] = [];
      registerInternalHook("session:idle", (event) => {
        idleEvents.push(event.sessionKey);
      });

      const sessions = new Map<string, IdleCheckableSession>([
        ["session-1", {}], // No activity = new session
      ]);
      const state = createIdleWatcherState();

      await checkIdleSessions(config, () => sessions, state);

      // New sessions without activity are not considered idle
      expect(idleEvents).toEqual([]);
    });
  });

  describe("startIdleWatcher / stopIdleWatcher", () => {
    it("does not start when disabled", () => {
      const config: IdleWatcherConfig = {
        enabled: false,
        checkIntervalMs: 1000,
        idleThresholdMs: 5000,
      };
      const getSessions = () => new Map();

      const state = startIdleWatcher(config, getSessions);

      expect(state.running).toBe(false);
      expect(state.intervalHandle).toBeNull();
    });

    it("starts interval when enabled", () => {
      const config: IdleWatcherConfig = {
        enabled: true,
        checkIntervalMs: 1000,
        idleThresholdMs: 5000,
      };
      const getSessions = () => new Map();

      const state = startIdleWatcher(config, getSessions);

      expect(state.running).toBe(true);
      expect(state.intervalHandle).not.toBeNull();

      stopIdleWatcher(state);
    });

    it("stops correctly", () => {
      const config: IdleWatcherConfig = {
        enabled: true,
        checkIntervalMs: 1000,
        idleThresholdMs: 5000,
      };
      const getSessions = () => new Map();

      const state = startIdleWatcher(config, getSessions);
      expect(state.running).toBe(true);

      stopIdleWatcher(state);

      expect(state.running).toBe(false);
      expect(state.intervalHandle).toBeNull();
      expect(state.lastIdleSessions.size).toBe(0);
    });

    it("calls checkIdleSessions on interval", async () => {
      const idleEvents: string[] = [];
      registerInternalHook("session:idle", (event) => {
        idleEvents.push(event.sessionKey);
      });

      const config: IdleWatcherConfig = {
        enabled: true,
        checkIntervalMs: 1000,
        idleThresholdMs: 5000,
      };
      const now = Date.now();
      const sessions = new Map<string, IdleCheckableSession>([
        ["session-1", { activity: { lastActivityAt: now - 10000, lastActivityType: "message" } }],
      ]);
      const getSessions = () => sessions;

      const state = startIdleWatcher(config, getSessions);

      // Advance timer to trigger interval
      await vi.advanceTimersByTimeAsync(1000);

      expect(idleEvents).toEqual(["session-1"]);

      stopIdleWatcher(state);
    });
  });
});
