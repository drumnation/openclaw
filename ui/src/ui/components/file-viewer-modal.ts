/**
 * Full-screen file viewer modal.
 * Fetches file content from /api/file?path=... and renders it.
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { toSanitizedMarkdownHtml } from "../markdown.ts";

type FileData = {
  content: string;
  size: number;
  modified: string;
  mimeType: string;
  path: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getLanguageClass(mimeType: string, filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    sh: "bash",
    css: "css",
    html: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    rs: "rust",
    go: "go",
    rb: "ruby",
    java: "java",
    c: "c",
    cpp: "cpp",
    sql: "sql",
    graphql: "graphql",
    xml: "xml",
    svg: "xml",
    toml: "toml",
  };
  return langMap[ext] ?? "plaintext";
}

function isMarkdown(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".md");
}

@customElement("file-viewer-modal")
export class FileViewerModal extends LitElement {
  @property({ type: String }) filePath = "";
  @property({ type: String }) basePath = "";

  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _data: FileData | null = null;

  static override styles = css`
    :host {
      display: block;
    }

    .overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .modal {
      width: 90vw;
      height: 90vh;
      max-width: 1200px;
      background: var(--bg-primary, #1e1e2e);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 1px solid var(--border-color, #313244);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: var(--bg-secondary, #181825);
      border-bottom: 1px solid var(--border-color, #313244);
      flex-shrink: 0;
    }

    .header-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .file-path {
      font-family: var(--font-mono, monospace);
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #cdd6f4);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-muted, #6c7086);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-muted, #6c7086);
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      font-size: 20px;
      line-height: 1;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .close-btn:hover {
      background: var(--bg-hover, #313244);
      color: var(--text-primary, #cdd6f4);
    }

    .body {
      flex: 1;
      overflow: auto;
      padding: 24px;
    }

    .body.markdown-body {
      line-height: 1.6;
    }

    .body.markdown-body h1,
    .body.markdown-body h2,
    .body.markdown-body h3,
    .body.markdown-body h4 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      color: var(--text-primary, #cdd6f4);
    }

    .body.markdown-body h1 {
      font-size: 1.8em;
    }
    .body.markdown-body h2 {
      font-size: 1.4em;
    }
    .body.markdown-body h3 {
      font-size: 1.2em;
    }

    .body.markdown-body p {
      margin: 0.8em 0;
      color: var(--text-secondary, #bac2de);
    }

    .body.markdown-body code {
      background: var(--bg-secondary, #181825);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }

    .body.markdown-body pre {
      background: var(--bg-secondary, #181825);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid var(--border-color, #313244);
    }

    .body.markdown-body pre code {
      background: none;
      padding: 0;
    }

    .body.markdown-body table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    .body.markdown-body th,
    .body.markdown-body td {
      border: 1px solid var(--border-color, #313244);
      padding: 8px 12px;
      text-align: left;
    }

    .body.markdown-body th {
      background: var(--bg-secondary, #181825);
    }

    .body.markdown-body a {
      color: var(--accent-color, #89b4fa);
    }

    .body.markdown-body blockquote {
      border-left: 3px solid var(--accent-color, #89b4fa);
      margin: 1em 0;
      padding: 0.5em 1em;
      color: var(--text-muted, #6c7086);
    }

    .code-body {
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      line-height: 1.6;
      white-space: pre;
      color: var(--text-secondary, #bac2de);
      tab-size: 2;
    }

    .loading,
    .error {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 14px;
    }

    .loading {
      color: var(--text-muted, #6c7086);
    }

    .error {
      color: var(--error-color, #f38ba8);
      flex-direction: column;
      gap: 8px;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this._fetchFile();
    document.addEventListener("keydown", this._onKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this._onKeyDown);
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      this._close();
    }
  };

  private _close() {
    this.dispatchEvent(new CustomEvent("close"));
  }

  private _onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains("overlay")) {
      this._close();
    }
  }

  private async _fetchFile() {
    if (!this.filePath) {
      return;
    }
    this._loading = true;
    this._error = null;
    try {
      const base = this.basePath ? this.basePath.replace(/\/+$/, "") : "";
      const url = `${base}/api/file?path=${encodeURIComponent(this.filePath)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        this._error = (data as { error?: string }).error ?? `HTTP ${res.status}`;
        return;
      }
      this._data = data as FileData;
    } catch (err) {
      this._error = `Failed to fetch file: ${String(err)}`;
    } finally {
      this._loading = false;
    }
  }

  override render() {
    return html`
      <div class="overlay" @click=${this._onOverlayClick}>
        <div class="modal">
          <div class="header">
            <div class="header-info">
              <div class="file-path">${this.filePath}</div>
              ${
                this._data
                  ? html`
                    <div class="file-meta">
                      <span>${formatFileSize(this._data.size)}</span>
                      <span>${formatDate(this._data.modified)}</span>
                      <span>${this._data.mimeType}</span>
                    </div>
                  `
                  : nothing
              }
            </div>
            <button class="close-btn" @click=${this._close} title="Close (Esc)">✕</button>
          </div>
          ${
            this._loading
              ? html`
                  <div class="body loading">Loading…</div>
                `
              : this._error
                ? html`<div class="body error"><span>⚠️ ${this._error}</span></div>`
                : this._data
                  ? this._renderContent(this._data)
                  : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderContent(data: FileData) {
    if (isMarkdown(data.path)) {
      return html`<div class="body markdown-body">${unsafeHTML(toSanitizedMarkdownHtml(data.content))}</div>`;
    }
    return html`<div class="body"><div class="code-body">${data.content}</div></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "file-viewer-modal": FileViewerModal;
  }
}
