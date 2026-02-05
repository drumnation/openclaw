# PR 3: Time Window Hooks

## Title
`feat(session): add time window hooks`

## Summary

Adds a time window watcher that monitors configurable time windows (e.g., business hours, quiet hours) and emits hooks when entering or exiting them.

## What it does

- Define named time windows with start/end hours and optional day-of-week constraints
- Emits `gateway:time_window:open` hook when entering a window
- Emits `gateway:time_window:close` hook when exiting a window
- Supports windows that cross midnight (e.g., 22:00-06:00)
- Disabled by default (opt-in)

## Configuration

```yaml
agents:
  main:
    session:
      timeWindow:
        enabled: true
        checkIntervalMs: 60000      # Check every minute
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

## Events Emitted

### `gateway:time_window:open`
Fired when entering a time window.

```json
{
  "source": "gateway",
  "event": "time_window:open",
  "sessionKey": "",
  "data": {
    "windowName": "business_hours",
    "startHour": 9,
    "endHour": 17,
    "daysOfWeek": [1, 2, 3, 4, 5]
  }
}
```

### `gateway:time_window:close`
Fired when exiting a time window.

```json
{
  "source": "gateway",
  "event": "time_window:close",
  "sessionKey": "",
  "data": {
    "windowName": "business_hours",
    "startHour": 9,
    "endHour": 17,
    "daysOfWeek": [1, 2, 3, 4, 5]
  }
}
```

## Changes

- New file: `src/session/time-window.ts`

## Backwards Compatibility

✅ **Fully backwards compatible**

- Disabled by default
- New feature, no changes to existing functionality
- Uses internal hooks system (no external API changes)

## Implementation Notes

- Uses `setInterval` with `.unref()` to avoid blocking Node exit
- Performs initial check on startup to establish current state
- Handles midnight-crossing windows correctly (e.g., 22:00-06:00)
- Day-of-week uses JavaScript convention (0=Sunday, 6=Saturday)
- Invalid hours/days are clamped/filtered during config resolution

## Testing

Unit tests included covering:
- Starting/stopping the watcher
- Window open/close detection
- Midnight-crossing windows
- Day-of-week filtering
- Configuration resolution
- Edge cases (disabled, no windows)

## Use Cases

- **Business hours**: Start daily tasks at 9 AM, cleanup at 5 PM
- **Quiet hours**: Reduce notifications from 10 PM to 7 AM
- **Weekend mode**: Different behavior on weekends
- **Maintenance windows**: Scheduled downtime handling

## Related

- PR 1: Activity Timestamp Tracking (parallel feature)
- PR 2: Idle Detection Watcher (parallel feature)
