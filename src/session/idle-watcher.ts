/**
 * Session Idle Detection Watcher
 *
 * Periodically checks sessions for idle state and emits hooks when sessions
 * become idle or resume activity.
 */

import type { SessionActivity } from "./activity.js";
import { createInternalHookEvent, triggerInternalHook } from "../hooks/internal-hooks.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getIdleMs, isSessionIdle } from "./activity.js";

const log = createSubsystemLogger("session/idle-watcher");

/**
 * Configuration for the idle watcher.
 */
export interface IdleWatcherConfig {
  /** Whether idle detection is enabled */
  enabled: boolean;
  /** Interval between idle checks in milliseconds (default: 60000 = 1 min) */
  checkIntervalMs: number;
  /** Time in milliseconds before a session is considered idle (default: 300000 = 5 min) */
  idleThresholdMs: number;
}

/**
 * Default idle watcher configuration.
 */
export const DEFAULT_IDLE_WATCHER_CONFIG: IdleWatcherConfig = {
  enabled: false,
  checkIntervalMs: 60_000, // 1 minute
  idleThresholdMs: 300_000, // 5 minutes
};

/**
 * State maintained by the idle watcher.
 */
export interface IdleWatcherState {
  /** Timer handle for the periodic check */
  intervalHandle: NodeJS.Timeout | null;
  /** Set of session keys that were idle on the last check */
  lastIdleSessions: Set<string>;
  /** Whether the watcher is running */
  running: boolean;
}

/**
 * Minimal session shape required for idle checking.
 */
export interface IdleCheckableSession {
  activity?: SessionActivity;
}

/**
 * Create initial idle watcher state.
 */
export function createIdleWatcherState(): IdleWatcherState {
  return {
    intervalHandle: null,
    lastIdleSessions: new Set(),
    running: false,
  };
}

/**
 * Check all sessions for idle state and emit hooks for state changes.
 */
export async function checkIdleSessions(
  config: IdleWatcherConfig,
  getSessions: () => Map<string, IdleCheckableSession>,
  state: IdleWatcherState,
): Promise<void> {
  const sessions = getSessions();
  const currentlyIdle = new Set<string>();

  for (const [key, session] of sessions) {
    if (isSessionIdle(session, config.idleThresholdMs)) {
      currentlyIdle.add(key);

      if (!state.lastIdleSessions.has(key)) {
        // Newly idle - emit session:idle hook
        const idleMs = getIdleMs(session);
        log.debug(`session became idle: ${key} (idle for ${idleMs}ms)`);

        const event = createInternalHookEvent("session", "idle", key, {
          idleMs,
          thresholdMs: config.idleThresholdMs,
        });
        await triggerInternalHook(event);
      }
    } else {
      // Session is active
      if (state.lastIdleSessions.has(key)) {
        // Was idle, now active - emit session:resume hook
        log.debug(`session resumed: ${key}`);

        const event = createInternalHookEvent("session", "resume", key, {});
        await triggerInternalHook(event);
      }
    }
  }

  // Update state for next check
  state.lastIdleSessions = currentlyIdle;
}

/**
 * Start the idle watcher with the given configuration.
 *
 * @param config - Idle watcher configuration
 * @param getSessions - Function to get the current session map
 * @returns The watcher state (use to stop the watcher later)
 */
export function startIdleWatcher(
  config: IdleWatcherConfig,
  getSessions: () => Map<string, IdleCheckableSession>,
): IdleWatcherState {
  const state = createIdleWatcherState();

  if (!config.enabled) {
    log.debug("idle watcher disabled");
    return state;
  }

  log.info(
    `starting idle watcher (check every ${config.checkIntervalMs}ms, idle threshold ${config.idleThresholdMs}ms)`,
  );

  state.running = true;
  state.intervalHandle = setInterval(() => {
    void checkIdleSessions(config, getSessions, state).catch((err) => {
      log.error(`idle check failed: ${String(err)}`);
    });
  }, config.checkIntervalMs);

  // Ensure the timer doesn't prevent Node from exiting
  state.intervalHandle.unref?.();

  return state;
}

/**
 * Stop the idle watcher.
 *
 * @param state - The watcher state returned from startIdleWatcher
 */
export function stopIdleWatcher(state: IdleWatcherState): void {
  if (state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
  }
  state.running = false;
  state.lastIdleSessions.clear();
  log.debug("idle watcher stopped");
}

/**
 * Resolve idle watcher config from raw config values.
 */
export function resolveIdleWatcherConfig(raw?: {
  enabled?: boolean;
  checkIntervalMs?: number;
  idleThresholdMs?: number;
}): IdleWatcherConfig {
  return {
    enabled: raw?.enabled ?? DEFAULT_IDLE_WATCHER_CONFIG.enabled,
    checkIntervalMs: raw?.checkIntervalMs ?? DEFAULT_IDLE_WATCHER_CONFIG.checkIntervalMs,
    idleThresholdMs: raw?.idleThresholdMs ?? DEFAULT_IDLE_WATCHER_CONFIG.idleThresholdMs,
  };
}
