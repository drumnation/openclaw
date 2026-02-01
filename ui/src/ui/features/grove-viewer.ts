/**
 * GROVE Documentation Viewer Feature
 *
 * Displays GROVE planning artifacts (PRDs, designs, stories, etc.)
 * for features tracked in docs/features/{name}/
 *
 * Inspired by legacy Brain Garden grove-documentation-viewer.
 * Ported to Lit for Clawdbot fork.
 */
import { html, nothing } from "lit";
import { featureRegistry } from "../feature-registry.js";
import type { GatewayBrowserClient } from "../gateway.js";

// ─── Types ───────────────────────────────────────────────────────

interface GroveViewState {
  client: GatewayBrowserClient | null;
  connected: boolean;
  tab: string;
}

interface GroveFeature {
  name: string;
  docs: string[];
}

interface GroveDoc {
  file: string;
  content: string;
  phase: string;
  type: string;
  title: string;
}

// ─── Local State ────────────────────────────────────────────────

let features: GroveFeature[] | null = null;
let selectedFeature: string | null = null;
let featureDocs: GroveDoc[] | null = null;
let selectedDoc: GroveDoc | null = null;
let loading = false;
let error: string | null = null;
let lastFetchTime = 0;

// ─── Phase/Type Detection ───────────────────────────────────────

const PHASE_MAP: Record<string, { label: string; emoji: string }> = {
  "00": { label: "Research", emoji: "🔍" },
  "01": { label: "PRD", emoji: "📋" },
  "02": { label: "Design", emoji: "🏗️" },
  "03": { label: "Stories", emoji: "📖" },
  "04": { label: "Development", emoji: "💻" },
  "05": { label: "Testing", emoji: "🧪" },
  "06": { label: "Documentation", emoji: "📝" },
  "07": { label: "Deployment", emoji: "🚀" },
  "08": { label: "Post-Launch", emoji: "📊" },
};

function detectPhase(filename: string): { phase: string; label: string; emoji: string } {
  const match = filename.match(/^(\d{2})-/);
  if (match && PHASE_MAP[match[1]]) {
    return { phase: match[1], ...PHASE_MAP[match[1]] };
  }
  if (filename.toLowerCase().includes("research")) { return { phase: "00", ...PHASE_MAP["00"] }; }
  if (filename.toLowerCase().includes("prd")) { return { phase: "01", ...PHASE_MAP["01"] }; }
  if (filename.toLowerCase().includes("design")) { return { phase: "02", ...PHASE_MAP["02"] }; }
  if (filename.toLowerCase().includes("stories") || filename.toLowerCase().includes("story")) { return { phase: "03", ...PHASE_MAP["03"] }; }
  return { phase: "99", label: "Other", emoji: "📄" };
}

function detectDocType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("prd")) { return "PRD"; }
  if (lower.includes("design")) { return "Design"; }
  if (lower.includes("research")) { return "Research"; }
  if (lower.includes("stories") || lower.includes("story")) { return "Stories"; }
  if (lower.includes("audit")) { return "Audit"; }
  if (lower === "readme.md") { return "Overview"; }
  return "Document";
}

function humanizeFilename(filename: string): string {
  return filename
    .replace(/\.md$/i, "")
    .replace(/^\d{2}-/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Data Fetching ──────────────────────────────────────────────

async function fetchFeatures(state: GroveViewState): Promise<void> {
  if (!state.client || !state.connected || loading) { return; }
  if (Date.now() - lastFetchTime < 15_000 && features) { return; }

  loading = true;
  error = null;
  try {
    // List docs/features/ directory — but workspace.list only supports allowlisted dirs
    // We need to read a known file and infer features from it, or use workspace.list
    // For now, try listing docs/features
    const res = await state.client.request("workspace.list", { dir: "docs/features" }) as
      { dir: string; files: string[] } | null;

    if (res?.files) {
      // Files in docs/features/ are subdirectories — but workspace.list returns .md files
      // We need the directory listing, not files. Let's work with what we get.
      // Actually, the dirs themselves won't show up (they're not .md files).
      // We need a different approach — try reading known features from TASKS.md
      // or scan for feature directories by trying known names.
      features = [];

      // Fallback: try to discover features from common names
      const knownFeatures = ["clawdbot-fork"];
      for (const name of knownFeatures) {
        const featureRes = await state.client.request("workspace.list", { dir: `docs/features/${name}` }) as
          { dir: string; files: string[] } | null;
        if (featureRes?.files && featureRes.files.length > 0) {
          features.push({ name, docs: featureRes.files });
        }
      }
    }
    lastFetchTime = Date.now();
  } catch (err) {
    error = String(err);
  } finally {
    loading = false;
  }
}

async function fetchDoc(state: GroveViewState, featureName: string, filename: string): Promise<void> {
  if (!state.client || !state.connected) { return; }
  selectedDoc = null;
  try {
    const res = await state.client.request("workspace.read", {
      file: `docs/features/${featureName}/${filename}`,
    }) as { file: string; content: string | null } | null;

    if (res?.content) {
      const phase = detectPhase(filename);
      selectedDoc = {
        file: filename,
        content: res.content,
        phase: phase.phase,
        type: detectDocType(filename),
        title: humanizeFilename(filename),
      };
    }
  } catch (err) {
    error = String(err);
  }
}

// ─── Markdown Rendering (lightweight) ───────────────────────────

function renderMarkdownBasic(content: string) {
  // Very basic markdown → HTML for the viewer
  // Split into sections for readability
  const lines = content.split("\n");
  const sections: Array<{ level: number; text: string; body: string[] }> = [];
  let current: { level: number; text: string; body: string[] } | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (headerMatch) {
      if (current) { sections.push(current); }
      current = { level: headerMatch[1].length, text: headerMatch[2], body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      if (!current) { current = { level: 0, text: "", body: [line] }; }
    }
  }
  if (current) { sections.push(current); }

  return html`
    ${sections.map((section) => {
      const bodyText = section.body.join("\n").trim();
      const headerStyle = section.level === 1
        ? "font-size: 1.3rem; font-weight: 700; margin: 1rem 0 0.5rem 0; border-bottom: 1px solid var(--color-border, #2a2a3e); padding-bottom: 0.5rem;"
        : section.level === 2
          ? "font-size: 1.1rem; font-weight: 600; margin: 0.8rem 0 0.3rem 0;"
          : "font-size: 0.95rem; font-weight: 600; margin: 0.6rem 0 0.2rem 0;";

      return html`
        ${section.text ? html`<div style="${headerStyle}">${section.text}</div>` : nothing}
        ${bodyText ? html`<pre style="
          white-space: pre-wrap;
          word-wrap: break-word;
          font-family: inherit;
          font-size: 0.85rem;
          line-height: 1.6;
          color: var(--color-secondary, #bbb);
          margin: 0 0 0.5rem 0;
        ">${bodyText}</pre>` : nothing}
      `;
    })}
  `;
}

// ─── Render Functions ───────────────────────────────────────────

function renderFeatureList() {
  if (!features || features.length === 0) {
    return html`
      <div style="padding: 2rem; text-align: center; color: var(--color-muted, #888);">
        No GROVE features found in docs/features/.<br>
        <span style="font-size: 0.8rem;">Features are discovered from the workspace docs directory.</span>
      </div>
    `;
  }

  return html`
    ${features.map((feature) => html`
      <div
        style="
          padding: 0.75rem 1rem;
          margin-bottom: 0.5rem;
          border-radius: 8px;
          background: ${selectedFeature === feature.name
            ? "var(--color-accent-bg, rgba(74, 158, 255, 0.1))"
            : "var(--color-surface, #1a1a2e)"};
          border: 1px solid ${selectedFeature === feature.name
            ? "var(--color-accent, #4a9eff)"
            : "var(--color-border, #2a2a3e)"};
          cursor: pointer;
        "
        @click=${() => { selectedFeature = feature.name; featureDocs = null; selectedDoc = null; }}
      >
        <div style="font-weight: 600; font-size: 0.9rem;">📁 ${feature.name}</div>
        <div style="font-size: 0.75rem; color: var(--color-muted, #888);">
          ${feature.docs.length} documents
        </div>
      </div>
    `)}
  `;
}

function renderDocList(state: GroveViewState, feature: GroveFeature) {
  const docs = feature.docs
    .map((f) => ({ filename: f, ...detectPhase(f), type: detectDocType(f), title: humanizeFilename(f) }))
    .sort((a, b) => a.phase.localeCompare(b.phase));

  return html`
    <div style="margin-bottom: 1rem;">
      <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted, #888); margin-bottom: 0.5rem;">
        📁 ${feature.name} — ${docs.length} docs
      </div>
      ${docs.map((doc) => html`
        <div
          style="
            padding: 0.5rem 0.75rem;
            margin-bottom: 0.3rem;
            border-radius: 6px;
            background: ${selectedDoc?.file === doc.filename
              ? "var(--color-accent-bg, rgba(74, 158, 255, 0.1))"
              : "var(--color-surface, #1a1a2e)"};
            border: 1px solid ${selectedDoc?.file === doc.filename
              ? "var(--color-accent, #4a9eff)"
              : "var(--color-border, #2a2a3e)"};
            cursor: pointer;
            font-size: 0.8rem;
          "
          @click=${() => { void fetchDoc(state, feature.name, doc.filename); }}
        >
          <span>${doc.emoji} ${doc.title}</span>
          <span style="float: right; font-size: 0.7rem; color: var(--color-muted, #666);">${doc.type}</span>
        </div>
      `)}
    </div>
  `;
}

function renderDocViewer() {
  if (!selectedDoc) {
    return html`
      <div style="padding: 2rem; text-align: center; color: var(--color-muted, #888);">
        Select a document to view
      </div>
    `;
  }

  return html`
    <div style="padding: 1rem;">
      <div style="
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 1rem; padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--color-border, #2a2a3e);
      ">
        <div>
          <div style="font-weight: 700; font-size: 1.1rem;">${selectedDoc.title}</div>
          <div style="font-size: 0.75rem; color: var(--color-muted, #888);">
            ${selectedDoc.type} · Phase ${selectedDoc.phase} · ${selectedDoc.file}
          </div>
        </div>
        <button
          style="
            padding: 0.3rem 0.6rem; border-radius: 4px;
            background: var(--color-surface, #1a1a2e);
            border: 1px solid var(--color-border, #2a2a3e);
            color: var(--color-muted, #888);
            cursor: pointer; font-size: 0.75rem;
          "
          @click=${() => { selectedDoc = null; }}
        >
          ← Back
        </button>
      </div>
      ${renderMarkdownBasic(selectedDoc.content)}
    </div>
  `;
}

function renderGroveViewer(state: GroveViewState) {
  void fetchFeatures(state);

  if (loading && !features) {
    return html`<div style="padding: 2rem; color: var(--color-muted, #888);">Loading GROVE features...</div>`;
  }

  if (error && !features) {
    return html`<div style="padding: 2rem; color: var(--color-error, #e53e3e);">Error: ${error}</div>`;
  }

  const currentFeature = features?.find((f) => f.name === selectedFeature);

  return html`
    <div style="padding: 1.25rem; max-width: 1200px;">
      <h2 style="margin: 0 0 1rem 0; font-size: 1.25rem;">🌳 GROVE Planning Viewer</h2>

      ${selectedDoc ? renderDocViewer() : html`
        <div style="display: grid; grid-template-columns: 250px 1fr; gap: 1rem; align-items: start;">
          <!-- Left: Feature list -->
          <div>
            <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted, #888); margin-bottom: 0.5rem;">
              Features
            </div>
            ${renderFeatureList()}
          </div>

          <!-- Right: Doc list for selected feature -->
          <div>
            ${currentFeature ? renderDocList(state, currentFeature) : html`
              <div style="padding: 2rem; text-align: center; color: var(--color-muted, #888);">
                Select a feature to browse its planning documents
              </div>
            `}
          </div>
        </div>
      `}
    </div>
  `;
}

// ─── Registration ───────────────────────────────────────────────

featureRegistry.register({
  id: "grove",
  tab: {
    group: "Work",
    path: "/grove",
    icon: "zap",
    title: "GROVE",
    subtitle: "Browse GROVE planning artifacts and feature documentation.",
  },
  render: (state) => renderGroveViewer(state as GroveViewState),
  enabled: false,  // OFF by default
});
