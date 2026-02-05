/**
 * Time Window Watcher
 *
 * Monitors configured time windows and emits hooks when entering or exiting them.
 * Used for business hours triggers and scheduled activity windows.
 */

import { createInternalHookEvent, triggerInternalHook } from "../hooks/internal-hooks.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("session/time-window");

/**
 * Configuration for a single time window.
 */
export interface TimeWindow {
  /** Unique name for this window (e.g., "business_hours") */
  name: string;
  /** Start hour in 24h format (0-23) */
  startHour: number;
  /** End hour in 24h format (0-23) */
  endHour: number;
  /** Days of week this window applies (0=Sun, 1=Mon, ..., 6=Sat). Default: all days */
  daysOfWeek?: number[];
}

/**
 * Configuration for the time window watcher.
 */
export interface TimeWindowConfig {
  /** Whether time window watching is enabled */
  enabled: boolean;
  /** List of time windows to monitor */
  windows: TimeWindow[];
  /** Interval between checks in milliseconds (default: 60000 = 1 min) */
  checkIntervalMs: number;
}

/**
 * Default time window watcher configuration.
 */
export const DEFAULT_TIME_WINDOW_CONFIG: TimeWindowConfig = {
  enabled: false,
  windows: [],
  checkIntervalMs: 60_000, // 1 minute
};

/**
 * State maintained by the time window watcher.
 */
export interface TimeWindowState {
  /** Timer handle for the periodic check */
  intervalHandle: NodeJS.Timeout | null;
  /** Set of window names that are currently active */
  activeWindows: Set<string>;
  /** Whether the watcher is running */
  running: boolean;
}

/**
 * Create initial time window watcher state.
 */
export function createTimeWindowState(): TimeWindowState {
  return {
    intervalHandle: null,
    activeWindows: new Set(),
    running: false,
  };
}

/**
 * Check if the current time is within a time window.
 */
export function isInTimeWindow(window: TimeWindow, now: Date = new Date()): boolean {
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  // Check day of week if specified
  if (window.daysOfWeek && window.daysOfWeek.length > 0) {
    if (!window.daysOfWeek.includes(currentDay)) {
      return false;
    }
  }

  // Handle windows that don't cross midnight
  if (window.startHour <= window.endHour) {
    return currentHour >= window.startHour && currentHour < window.endHour;
  }

  // Handle windows that cross midnight (e.g., 22:00 - 06:00)
  return currentHour >= window.startHour || currentHour < window.endHour;
}

/**
 * Check all time windows and emit hooks for state changes.
 */
export async function checkTimeWindows(
  config: TimeWindowConfig,
  state: TimeWindowState,
): Promise<void> {
  const now = new Date();

  for (const window of config.windows) {
    const isActive = isInTimeWindow(window, now);
    const wasActive = state.activeWindows.has(window.name);

    if (isActive && !wasActive) {
      // Window just opened
      log.debug(`time window opened: ${window.name}`);
      state.activeWindows.add(window.name);

      const event = createInternalHookEvent("gateway", "time_window:open", "", {
        windowName: window.name,
        startHour: window.startHour,
        endHour: window.endHour,
        daysOfWeek: window.daysOfWeek,
      });
      await triggerInternalHook(event);
    } else if (!isActive && wasActive) {
      // Window just closed
      log.debug(`time window closed: ${window.name}`);
      state.activeWindows.delete(window.name);

      const event = createInternalHookEvent("gateway", "time_window:close", "", {
        windowName: window.name,
        startHour: window.startHour,
        endHour: window.endHour,
        daysOfWeek: window.daysOfWeek,
      });
      await triggerInternalHook(event);
    }
  }
}

/**
 * Start the time window watcher.
 *
 * @param config - Time window configuration
 * @returns The watcher state (use to stop the watcher later)
 */
export function startTimeWindowWatcher(config: TimeWindowConfig): TimeWindowState {
  const state = createTimeWindowState();

  if (!config.enabled || config.windows.length === 0) {
    log.debug("time window watcher disabled or no windows configured");
    return state;
  }

  log.info(
    `starting time window watcher (${config.windows.length} windows, check every ${config.checkIntervalMs}ms)`,
  );

  state.running = true;

  // Do an initial check to set up state
  void checkTimeWindows(config, state).catch((err) => {
    log.error(`initial time window check failed: ${String(err)}`);
  });

  state.intervalHandle = setInterval(() => {
    void checkTimeWindows(config, state).catch((err) => {
      log.error(`time window check failed: ${String(err)}`);
    });
  }, config.checkIntervalMs);

  // Ensure the timer doesn't prevent Node from exiting
  state.intervalHandle.unref?.();

  return state;
}

/**
 * Stop the time window watcher.
 *
 * @param state - The watcher state returned from startTimeWindowWatcher
 */
export function stopTimeWindowWatcher(state: TimeWindowState): void {
  if (state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
  }
  state.running = false;
  state.activeWindows.clear();
  log.debug("time window watcher stopped");
}

/**
 * Resolve time window config from raw config values.
 */
export function resolveTimeWindowConfig(raw?: {
  enabled?: boolean;
  windows?: Array<{
    name?: string;
    startHour?: number;
    endHour?: number;
    daysOfWeek?: number[];
  }>;
  checkIntervalMs?: number;
}): TimeWindowConfig {
  const windows: TimeWindow[] = [];

  if (Array.isArray(raw?.windows)) {
    for (const w of raw.windows) {
      if (typeof w.name === "string" && w.name.trim()) {
        windows.push({
          name: w.name.trim(),
          startHour: typeof w.startHour === "number" ? Math.max(0, Math.min(23, w.startHour)) : 0,
          endHour: typeof w.endHour === "number" ? Math.max(0, Math.min(23, w.endHour)) : 0,
          daysOfWeek: Array.isArray(w.daysOfWeek)
            ? w.daysOfWeek.filter((d) => d >= 0 && d <= 6)
            : undefined,
        });
      }
    }
  }

  return {
    enabled: raw?.enabled ?? DEFAULT_TIME_WINDOW_CONFIG.enabled,
    windows,
    checkIntervalMs: raw?.checkIntervalMs ?? DEFAULT_TIME_WINDOW_CONFIG.checkIntervalMs,
  };
}
