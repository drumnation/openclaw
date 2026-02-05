# PR 2: Idle Detection Watcher

## Title
`feat(session): add idle detection watcher`

## Summary

Adds a periodic watcher that monitors sessions for idle state and emits hooks when sessions become idle or resume activity.

## What it does

- Periodically checks all sessions against an idle threshold
- Emits `session:idle` hook when a session becomes idle
- Emits `session:resume` hook when an idle session becomes active again
- Configurable check interval and idle threshold
- Disabled by default (opt-in)

## Configuration

```yaml
agents:
  main:
    session:
      idleWatcher:
        enabled: true
        checkIntervalMs: 60000      # Check every minute
        idleThresholdMs: 300000     # 5 minutes = idle
```

## Events Emitted

### `session:idle`
Fired when a session crosses the idle threshold.

```json
{
  "source": "session",
  "event": "idle",
  "sessionKey": "agent:main:webchat",
  "data": {
    "idleMs": 305000,
    "thresholdMs": 300000
  }
}
```

### `session:resume`
Fired when an idle session becomes active again.

```json
{
  "source": "session",
  "event": "resume",
  "sessionKey": "agent:main:webchat",
  "data": {}
}
```

## Changes

- New file: `src/session/idle-watcher.ts`

## Backwards Compatibility

✅ **Fully backwards compatible**

- Disabled by default
- Existing sessions unaffected unless explicitly enabled
- Uses internal hooks system (no external API changes)

## Implementation Notes

- Uses `setInterval` with `.unref()` to avoid blocking Node exit
- Maintains state of previously-idle sessions to detect transitions
- Errors during checks are logged but don't crash the watcher

## Testing

Unit tests included covering:
- Starting/stopping the watcher
- Idle detection and event emission
- Resume detection and event emission
- Configuration resolution
- Edge cases (disabled, no sessions)

## Dependencies

- Depends on PR 1 (activity tracking)

## Related

- PR 1: Activity Timestamp Tracking (dependency)
- PR 3: Time Window Hooks (parallel feature)
