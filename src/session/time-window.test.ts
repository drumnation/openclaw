import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isInTimeWindow,
  checkTimeWindows,
  startTimeWindowWatcher,
  stopTimeWindowWatcher,
  resolveTimeWindowConfig,
  type TimeWindow,
  type TimeWindowConfig,
  type TimeWindowState,
} from "./time-window.js";

// Mock the internal hooks module
vi.mock("../hooks/internal-hooks.js", () => ({
  createInternalHookEvent: vi.fn((type, action, sessionKey, context) => ({
    type,
    action,
    sessionKey,
    context,
    timestamp: new Date(),
    messages: [],
  })),
  triggerInternalHook: vi.fn(),
}));

describe("time-window", () => {
  describe("isInTimeWindow", () => {
    it("returns true when current hour is within window", () => {
      const window: TimeWindow = { name: "test", startHour: 9, endHour: 17 };
      const noon = new Date("2024-01-15T12:00:00");
      expect(isInTimeWindow(window, noon)).toBe(true);
    });

    it("returns false when current hour is before window", () => {
      const window: TimeWindow = { name: "test", startHour: 9, endHour: 17 };
      const early = new Date("2024-01-15T08:00:00");
      expect(isInTimeWindow(window, early)).toBe(false);
    });

    it("returns false when current hour equals end hour", () => {
      const window: TimeWindow = { name: "test", startHour: 9, endHour: 17 };
      const atEnd = new Date("2024-01-15T17:00:00");
      expect(isInTimeWindow(window, atEnd)).toBe(false);
    });

    it("returns true when current hour equals start hour", () => {
      const window: TimeWindow = { name: "test", startHour: 9, endHour: 17 };
      const atStart = new Date("2024-01-15T09:00:00");
      expect(isInTimeWindow(window, atStart)).toBe(true);
    });

    it("handles overnight windows (crossing midnight)", () => {
      const window: TimeWindow = { name: "night", startHour: 22, endHour: 6 };

      // 23:00 should be in window
      expect(isInTimeWindow(window, new Date("2024-01-15T23:00:00"))).toBe(true);
      // 03:00 should be in window
      expect(isInTimeWindow(window, new Date("2024-01-15T03:00:00"))).toBe(true);
      // 12:00 should not be in window
      expect(isInTimeWindow(window, new Date("2024-01-15T12:00:00"))).toBe(false);
    });

    it("filters by days of week when specified", () => {
      const window: TimeWindow = {
        name: "weekday",
        startHour: 9,
        endHour: 17,
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      };

      // Monday at noon
      const monday = new Date("2024-01-15T12:00:00"); // Jan 15, 2024 is Monday
      expect(isInTimeWindow(window, monday)).toBe(true);

      // Sunday at noon
      const sunday = new Date("2024-01-14T12:00:00"); // Jan 14, 2024 is Sunday
      expect(isInTimeWindow(window, sunday)).toBe(false);
    });

    it("includes all days when daysOfWeek is empty", () => {
      const window: TimeWindow = {
        name: "everyday",
        startHour: 9,
        endHour: 17,
        daysOfWeek: [],
      };

      const sunday = new Date("2024-01-14T12:00:00");
      expect(isInTimeWindow(window, sunday)).toBe(true);
    });
  });

  describe("checkTimeWindows", () => {
    let triggerInternalHook: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const hooks = await import("../hooks/internal-hooks.js");
      triggerInternalHook = hooks.triggerInternalHook as ReturnType<typeof vi.fn>;
      triggerInternalHook.mockClear();
    });

    it("emits time_window:open when window becomes active", async () => {
      const config: TimeWindowConfig = {
        enabled: true,
        windows: [{ name: "business", startHour: 0, endHour: 23 }],
        checkIntervalMs: 60000,
      };
      const state: TimeWindowState = {
        intervalHandle: null,
        activeWindows: new Set(),
        running: true,
      };

      await checkTimeWindows(config, state);

      expect(triggerInternalHook).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "time_window:open",
          context: expect.objectContaining({ windowName: "business" }),
        }),
      );
      expect(state.activeWindows.has("business")).toBe(true);
    });

    it("emits time_window:close when window becomes inactive", async () => {
      const config: TimeWindowConfig = {
        enabled: true,
        windows: [{ name: "past", startHour: 0, endHour: 1 }], // Rarely active
        checkIntervalMs: 60000,
      };
      const state: TimeWindowState = {
        intervalHandle: null,
        activeWindows: new Set(["past"]), // Was active
        running: true,
      };

      // Check at 12:00 - window should be closed
      await checkTimeWindows(config, state);

      // If current hour is not 0, the window should close
      const currentHour = new Date().getHours();
      if (currentHour !== 0) {
        expect(triggerInternalHook).toHaveBeenCalledWith(
          expect.objectContaining({
            action: "time_window:close",
            context: expect.objectContaining({ windowName: "past" }),
          }),
        );
        expect(state.activeWindows.has("past")).toBe(false);
      }
    });

    it("does not emit when state is unchanged", async () => {
      const config: TimeWindowConfig = {
        enabled: true,
        windows: [{ name: "always", startHour: 0, endHour: 23 }],
        checkIntervalMs: 60000,
      };
      const state: TimeWindowState = {
        intervalHandle: null,
        activeWindows: new Set(["always"]), // Already active
        running: true,
      };

      await checkTimeWindows(config, state);

      // Should not emit open because it was already active
      expect(triggerInternalHook).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: "time_window:open" }),
      );
    });
  });

  describe("startTimeWindowWatcher / stopTimeWindowWatcher", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns inactive state when disabled", () => {
      const config: TimeWindowConfig = {
        enabled: false,
        windows: [{ name: "test", startHour: 9, endHour: 17 }],
        checkIntervalMs: 60000,
      };

      const state = startTimeWindowWatcher(config);

      expect(state.running).toBe(false);
      expect(state.intervalHandle).toBe(null);
    });

    it("returns inactive state when no windows configured", () => {
      const config: TimeWindowConfig = {
        enabled: true,
        windows: [],
        checkIntervalMs: 60000,
      };

      const state = startTimeWindowWatcher(config);

      expect(state.running).toBe(false);
      expect(state.intervalHandle).toBe(null);
    });

    it("starts interval when enabled with windows", () => {
      const config: TimeWindowConfig = {
        enabled: true,
        windows: [{ name: "test", startHour: 9, endHour: 17 }],
        checkIntervalMs: 60000,
      };

      const state = startTimeWindowWatcher(config);

      expect(state.running).toBe(true);
      expect(state.intervalHandle).not.toBe(null);

      stopTimeWindowWatcher(state);
    });

    it("stops interval and clears state on stop", () => {
      const config: TimeWindowConfig = {
        enabled: true,
        windows: [{ name: "test", startHour: 0, endHour: 23 }],
        checkIntervalMs: 60000,
      };

      const state = startTimeWindowWatcher(config);
      expect(state.running).toBe(true);
      expect(state.activeWindows.size).toBeGreaterThan(0);

      stopTimeWindowWatcher(state);

      expect(state.running).toBe(false);
      expect(state.intervalHandle).toBe(null);
      expect(state.activeWindows.size).toBe(0);
    });
  });

  describe("resolveTimeWindowConfig", () => {
    it("returns defaults for undefined input", () => {
      const config = resolveTimeWindowConfig(undefined);

      expect(config.enabled).toBe(false);
      expect(config.windows).toEqual([]);
      expect(config.checkIntervalMs).toBe(60000);
    });

    it("parses valid window configurations", () => {
      const config = resolveTimeWindowConfig({
        enabled: true,
        windows: [
          { name: "business", startHour: 9, endHour: 17 },
          { name: "evening", startHour: 18, endHour: 22, daysOfWeek: [1, 2, 3, 4, 5] },
        ],
        checkIntervalMs: 30000,
      });

      expect(config.enabled).toBe(true);
      expect(config.windows.length).toBe(2);
      expect(config.windows[0].name).toBe("business");
      expect(config.windows[1].daysOfWeek).toEqual([1, 2, 3, 4, 5]);
      expect(config.checkIntervalMs).toBe(30000);
    });

    it("clamps hour values to valid range", () => {
      const config = resolveTimeWindowConfig({
        enabled: true,
        windows: [{ name: "test", startHour: -5, endHour: 30 }],
      });

      expect(config.windows[0].startHour).toBe(0);
      expect(config.windows[0].endHour).toBe(23);
    });

    it("filters invalid daysOfWeek values", () => {
      const config = resolveTimeWindowConfig({
        enabled: true,
        windows: [{ name: "test", startHour: 9, endHour: 17, daysOfWeek: [-1, 0, 3, 7, 10] }],
      });

      expect(config.windows[0].daysOfWeek).toEqual([0, 3]);
    });

    it("skips windows without a name", () => {
      const config = resolveTimeWindowConfig({
        enabled: true,
        windows: [
          { name: "", startHour: 9, endHour: 17 },
          { name: "valid", startHour: 9, endHour: 17 },
          { startHour: 9, endHour: 17 } as any,
        ],
      });

      expect(config.windows.length).toBe(1);
      expect(config.windows[0].name).toBe("valid");
    });
  });
});
