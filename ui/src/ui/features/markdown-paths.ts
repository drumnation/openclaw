/**
 * Clickable Markdown Paths Feature
 *
 * Detects file paths in messages (e.g., ~/clawd/docs/README.md) and makes them
 * clickable, opening the file content in the sidebar for viewing and editing.
 */
import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { GatewayBrowserClient } from "../gateway.js";
import { icons } from "../icons.js";
import { toSanitizedMarkdownHtml } from "../markdown.js";

// ─── Types ───────────────────────────────────────────────────────

export interface MarkdownFileState {
  path: string;
  filename: string;
  content: string | null;
  originalContent: string | null;
  loading: boolean;
  saving: boolean;
  editing: boolean;
  error: string | null;
  dirty: boolean;
}

export interface ContextChip {
  path: string;
  filename: string;
}

// ─── Path Detection ──────────────────────────────────────────────

/**
 * Regex to detect markdown file paths in text.
 * Matches:
 * - /absolute/path/file.md
 * - ~/relative/path/file.md
 * - Mac:~/Dev/path/file.md
 * - ./relative/file.md or ../parent/file.md
 * - relative/path/file.md (must contain at least one /)
 */
export const MD_PATH_REGEX = /(?:Mac:|Win:|Linux:)?(?:~\/|\.\.?\/|\/)?(?:[\w.-]+\/)+[\w.-]+\.md/g;

/**
 * Extract all markdown file paths from text
 */
export function extractMarkdownPaths(text: string): string[] {
  const matches = text.match(MD_PATH_REGEX);
  if (!matches) {
    return [];
  }
  // Deduplicate
  return [...new Set(matches)];
}

/**
 * Get the filename from a path
 */
export function getFilename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Normalize a path for the workspace API
 * Removes Mac:/Win:/Linux: prefixes and expands ~ relative to workspace
 */
export function normalizePath(path: string): string {
  // Remove OS prefix
  let normalized = path.replace(/^(?:Mac|Win|Linux):/, "");
  // For now, we'll pass the path as-is to the gateway
  // The gateway will need to handle ~ expansion
  return normalized;
}

// ─── HTML Transformation ─────────────────────────────────────────

/**
 * Transform markdown text to make .md paths clickable
 * Returns HTML string with paths wrapped in clickable spans
 */
export function transformPathsToLinks(text: string): string {
  if (!text) {
    return text;
  }

  return text.replace(MD_PATH_REGEX, (match) => {
    const escaped = escapeHtml(match);
    const filename = getFilename(match);
    // Use a data attribute to store the full path
    return `<span class="md-path-link" data-path="${escaped}" title="Click to open ${filename}">${escaped}</span>`;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── File Operations ─────────────────────────────────────────────

/**
 * Fetch a markdown file's content via the gateway
 */
export async function fetchMarkdownFile(
  client: GatewayBrowserClient,
  path: string,
): Promise<{ content: string | null; error: string | null }> {
  try {
    const normalizedPath = normalizePath(path);
    const result = await client.request<{ file: string; content: string | null }>(
      "workspace.read",
      { file: normalizedPath },
    );
    return { content: result?.content ?? null, error: null };
  } catch (err) {
    return { content: null, error: String(err) };
  }
}

/**
 * Save a markdown file's content via the gateway
 */
export async function saveMarkdownFile(
  client: GatewayBrowserClient,
  path: string,
  content: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const normalizedPath = normalizePath(path);
    await client.request("workspace.write", { file: normalizedPath, content });
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Sidebar Renderer ────────────────────────────────────────────

export interface MarkdownFileSidebarProps {
  state: MarkdownFileState;
  onClose: () => void;
  onEdit: () => void;
  onSave: (content: string) => void;
  onCancel: () => void;
  onContentChange: (content: string) => void;
}

export function renderMarkdownFileSidebar(props: MarkdownFileSidebarProps) {
  const { state, onClose, onEdit, onSave, onCancel, onContentChange } = props;

  return html`
    <div class="sidebar-panel md-file-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title" title="${state.path}">
          📄 ${state.filename}
          ${
            state.dirty
              ? html`
                  <span class="md-file-dirty">*</span>
                `
              : nothing
          }
        </div>
        <div class="sidebar-actions">
          ${
            state.editing
              ? html`
                <button
                  class="btn btn-sm"
                  @click=${onCancel}
                  ?disabled=${state.saving}
                  title="Cancel editing"
                >
                  Cancel
                </button>
                <button
                  class="btn btn-sm primary"
                  @click=${() => onSave(state.content ?? "")}
                  ?disabled=${state.saving || !state.dirty}
                  title="Save changes"
                >
                  ${state.saving ? "Saving..." : "Save"}
                </button>
              `
              : html`
                <button
                  class="btn btn-sm"
                  @click=${onEdit}
                  ?disabled=${state.loading || state.content === null}
                  title="Edit file"
                >
                  ${icons.edit ?? "✏️"} Edit
                </button>
              `
          }
          <button @click=${onClose} class="btn btn-sm" title="Close sidebar">
            ${icons.x}
          </button>
        </div>
      </div>
      <div class="sidebar-content">
        ${
          state.loading
            ? html`
                <div class="md-file-loading">Loading...</div>
              `
            : state.error
              ? html`<div class="callout danger">${state.error}</div>`
              : state.content === null
                ? html`
                    <div class="muted">File not found or empty</div>
                  `
                : state.editing
                  ? html`
                    <textarea
                      class="md-file-editor"
                      .value=${state.content}
                      @input=${(e: Event) => {
                        const target = e.target as HTMLTextAreaElement;
                        onContentChange(target.value);
                      }}
                      ?disabled=${state.saving}
                    ></textarea>
                  `
                  : html`
                    <div class="sidebar-markdown">
                      ${unsafeHTML(toSanitizedMarkdownHtml(state.content))}
                    </div>
                  `
        }
      </div>
    </div>
  `;
}

// ─── Context Chips Renderer ──────────────────────────────────────

export interface ContextChipsProps {
  chips: ContextChip[];
  onRemove: (path: string) => void;
  onClick: (path: string) => void;
}

export function renderContextChips(props: ContextChipsProps) {
  if (props.chips.length === 0) {
    return nothing;
  }

  return html`
    <div class="md-context-chips">
      ${props.chips.map(
        (chip) => html`
          <div class="md-context-chip" @click=${() => props.onClick(chip.path)}>
            <span class="md-context-chip__icon">📄</span>
            <span class="md-context-chip__name">${chip.filename}</span>
            <button
              class="md-context-chip__remove"
              @click=${(e: Event) => {
                e.stopPropagation();
                props.onRemove(chip.path);
              }}
              title="Remove from context"
            >
              ×
            </button>
          </div>
        `,
      )}
    </div>
  `;
}

// ─── CSS Styles ──────────────────────────────────────────────────

export const markdownPathsStyles = `
  /* Clickable path links in messages */
  .md-path-link {
    color: var(--color-accent, #4a9eff);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
    cursor: pointer;
    font-family: var(--font-mono, monospace);
    font-size: 0.9em;
    padding: 0 2px;
    border-radius: 2px;
    transition: background-color 0.15s, color 0.15s;
  }

  .md-path-link:hover {
    background-color: var(--color-accent-bg, rgba(74, 158, 255, 0.1));
    text-decoration-style: solid;
  }

  /* File sidebar styles */
  .md-file-sidebar .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .md-file-sidebar .sidebar-title {
    font-weight: 600;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .md-file-sidebar .sidebar-actions {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .md-file-dirty {
    color: var(--color-warning, #ed8936);
    margin-left: 0.25rem;
  }

  .md-file-loading {
    padding: 2rem;
    text-align: center;
    color: var(--color-muted, #888);
  }

  .md-file-editor {
    width: 100%;
    height: 100%;
    min-height: 300px;
    padding: 0.75rem;
    font-family: var(--font-mono, monospace);
    font-size: 0.85rem;
    line-height: 1.5;
    border: 1px solid var(--color-border, #2a2a3e);
    border-radius: 6px;
    background: var(--color-surface, #1a1a2e);
    color: var(--color-text, #fff);
    resize: vertical;
  }

  .md-file-editor:focus {
    outline: none;
    border-color: var(--color-accent, #4a9eff);
  }

  /* Context chips */
  .md-context-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .md-context-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--color-border, #2a2a3e);
    border-radius: 16px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s;
  }

  .md-context-chip:hover {
    background: var(--color-surface-hover, #252540);
    border-color: var(--color-accent, #4a9eff);
  }

  .md-context-chip__icon {
    font-size: 0.8em;
  }

  .md-context-chip__name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .md-context-chip__remove {
    background: none;
    border: none;
    color: var(--color-muted, #888);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.15rem;
    margin-left: 0.15rem;
  }

  .md-context-chip__remove:hover {
    color: var(--color-error, #e53e3e);
  }
`;
