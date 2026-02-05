# PR 1: Activity Timestamp Tracking

## Title
`feat(session): add activity timestamp tracking`

## Summary

Adds foundational activity tracking to sessions, enabling downstream features like idle detection and time-based lifecycle hooks.

## What it does

- Adds `SessionActivity` interface to track:
  - `lastActivityAt` — Unix timestamp of last meaningful activity
  - `lastActivityType` — Type of activity (`message`, `agent`, or `tool`)
  
- Provides utility functions:
  - `updateSessionActivity()` — Updates the activity timestamp on a session
  - `getIdleMs()` — Returns milliseconds since last activity
  - `isSessionIdle()` — Checks if a session has been idle past a threshold

## Why

This is the foundation for session lifecycle features. By tracking when sessions are active, we can:
- Detect idle sessions and trigger cleanup/summarization
- Understand usage patterns
- Enable time-based automation hooks

## Changes

- New file: `src/session/activity.ts`

## Backwards Compatibility

✅ **Fully backwards compatible**

- Adds new optional `activity` field to session objects
- No changes to existing APIs
- Sessions without activity tracking continue to work (treated as "new, not idle")

## Testing

Unit tests included covering:
- Activity timestamp updates
- Idle duration calculation
- Idle threshold detection
- Edge cases (no activity recorded)

## Related

- PR 2: Idle Detection Watcher (depends on this)
- PR 3: Time Window Hooks
