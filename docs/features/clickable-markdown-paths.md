# Clickable Markdown Paths Feature

## Overview
When Gordon outputs file paths like `~/clawd/TASKS.md` or `docs/features/foo/01-prd.md`, they become clickable links in the webchat UI. Clicking opens the file in a sidebar panel for viewing and editing.

## How It Works

### Path Detection
The regex `MD_PATH_REGEX` detects paths like:
- `~/clawd/TASKS.md`
- `docs/features/foo/01-prd.md`
- `/home/user/projects/file.md`
- `./local/file.md`
- `Mac:~/Dev/project/file.md`

**Note:** Single filenames like `README.md` without a path separator don't match (to avoid false positives).

### Path Transformation
In `markdown.ts`, the `toSanitizedMarkdownHtml()` function transforms detected paths into clickable `<span class="md-path-link">` elements with `data-path` attributes.

### Click Handling
The chat thread has a click handler that:
1. Detects clicks on `.md-path-link` elements
2. Extracts the `data-path` attribute
3. Calls `handleOpenFileSidebar(path)`

### File Sidebar
When a path is clicked:
1. The sidebar switches to "file" mode
2. Path is normalized (strips `~/clawd/` prefix, etc.)
3. File content is fetched via `workspace.read` API
4. Content is displayed as rendered markdown
5. "Edit" button enables a textarea for modifications
6. "Save" button writes changes via `workspace.write` API

### Context Chips
Clicked files are added as "context chips" above the compose area. Click a chip to reopen the file. Click × to remove.

## Gateway API

### workspace.read
```typescript
{ file: "TASKS.md" } → { file: "TASKS.md", content: "..." }
```

### workspace.write
```typescript
{ file: "TASKS.md", content: "..." } → { file: "TASKS.md", written: true }
```

### Allowed Paths
- Root files: TASKS.md, MEMORY.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, AGENTS.md, HEARTBEAT.md
- Directories: docs/**, memory/**, projects/**, shared/**

## CSS Classes

- `.md-path-link` - Clickable path link styling
- `.md-file-sidebar` - File sidebar container
- `.md-file-editor` - Edit mode textarea
- `.md-file-dirty` - Dirty indicator (*)
- `.md-context-chips` - Context chips container
- `.md-context-chip` - Individual chip

## Mobile Support
On screens < 768px, the sidebar takes full screen when open.

## Files Changed

### UI (openclaw-fork/ui/src/ui/)
- `features/markdown-paths.ts` - Path detection, normalization, sidebar rendering
- `features/markdown-paths.test.ts` - Unit tests
- `markdown.ts` - Integrated path transformation
- `markdown.test.ts` - Added path transformation tests
- `views/chat.ts` - Click handler, sidebar mode switching
- `app.ts` - State management, file operations

### Styles (openclaw-fork/ui/src/styles/)
- `chat/sidebar.css` - All markdown path styles

### Gateway (openclaw-fork/src/gateway/)
- `server-methods/workspace.ts` - Expanded allowlist
- `server-methods/workspace.test.ts` - Updated tests

## Testing
```bash
# Run UI tests
cd ui && npx vitest run src/ui/features/markdown-paths.test.ts
cd ui && npx vitest run src/ui/markdown.test.ts

# Run gateway tests
npx vitest run src/gateway/server-methods/workspace.test.ts
```

## Usage
1. Start the dev server: `pnpm dev --port 19001 --host`
2. Open https://dev-gordon.singularity-labs.org
3. Have Gordon output a file path in a message
4. Click the path to open in sidebar
5. Edit and save as needed
