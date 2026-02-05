# Session Lifecycle Events

## Overview

Clawdbot can emit events when sessions become idle or resume activity, and when configurable time windows open or close. These hooks enable automation like auto-summarization when a conversation goes stale, or triggering cleanup when leaving business hours.

## Configuration

### Idle Detection

Track session activity and emit events when sessions become idle:

```yaml
agents:
  main:
    session:
      idleWatcher:
        enabled: true
        checkIntervalMs: 60000      # Check every minute (default)
        idleThresholdMs: 300000     # 5 minutes idle = idle event (default)
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `false` | Enable idle detection |
| `checkIntervalMs` | `60000` | How often to check sessions (ms) |
| `idleThresholdMs` | `300000` | Time before a session is considered idle (ms) |

### Time Windows

Define named time windows and receive events when entering or exiting them:

```yaml
agents:
  main:
    session:
      timeWindow:
        enabled: true
        checkIntervalMs: 60000      # Check every minute (default)
        windows:
          - name: business_hours
            startHour: 9
            endHour: 17
            daysOfWeek: [1, 2, 3, 4, 5]  # Mon-Fri
          
          - name: quiet_hours
            startHour: 22
            endHour: 7
            # No daysOfWeek = all days
```

**Window Options:**
| Option | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Unique identifier for the window |
| `startHour` | Yes | Start hour in 24h format (0-23) |
| `endHour` | Yes | End hour in 24h format (0-23) |
| `daysOfWeek` | No | Days to apply (0=Sun, 1=Mon, ..., 6=Sat). Default: all days |

**Note:** Windows can cross midnight. A window with `startHour: 22` and `endHour: 6` is active from 10 PM to 6 AM.

## Events

### Session Events

- **`session:idle`** — Fired when a session crosses the idle threshold
  - Payload: `{ idleMs, thresholdMs }`
  
- **`session:resume`** — Fired when an idle session becomes active again
  - Payload: `{}`

### Time Window Events

- **`gateway:time_window:open`** — Fired when entering a time window
  - Payload: `{ windowName, startHour, endHour, daysOfWeek }`
  
- **`gateway:time_window:close`** — Fired when exiting a time window
  - Payload: `{ windowName, startHour, endHour, daysOfWeek }`

## Activity Types

Session activity is updated automatically when:
- A message is received (`message`)
- The agent responds (`agent`)
- A tool is invoked (`tool`)

## Use Cases

### Auto-summarize on idle
When a session goes idle, trigger a summary of the conversation to capture context before it's lost.

### Quiet hours
Pause notifications or reduce polling frequency during quiet hours (e.g., 10 PM to 7 AM).

### Business hours triggers
Start daily tasks when business hours begin, run cleanup when they end.

### Session cleanup
When sessions have been idle too long, archive or clean up resources.

## API Reference

### Activity Tracking (`src/session/activity.ts`)

```typescript
// Update activity timestamp
updateSessionActivity(session, type: 'message' | 'agent' | 'tool')

// Get idle duration in ms
getIdleMs(session): number

// Check if session exceeds idle threshold
isSessionIdle(session, thresholdMs): boolean
```

### Idle Watcher (`src/session/idle-watcher.ts`)

```typescript
// Start watching sessions for idle state
const state = startIdleWatcher(config, getSessions)

// Stop the watcher
stopIdleWatcher(state)

// Resolve config from raw values
resolveIdleWatcherConfig(raw?): IdleWatcherConfig
```

### Time Window (`src/session/time-window.ts`)

```typescript
// Start watching time windows
const state = startTimeWindowWatcher(config)

// Stop the watcher
stopTimeWindowWatcher(state)

// Check if currently in a window
isInTimeWindow(window, now?): boolean

// Resolve config from raw values
resolveTimeWindowConfig(raw?): TimeWindowConfig
```
