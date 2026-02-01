/**
 * Tasks Feature — Project & Sub-Agent Status Board
 *
 * Combines two data sources:
 * 1. TASKS.md parsed via workspace.read gateway RPC
 * 2. Active sessions via sessions.list gateway RPC
 *
 * MVP: Visual task board + sub-agent status.
 */
import { html, nothing } from "lit";
import { featureRegistry } from "../feature-registry.js";
import type { GatewayBrowserClient } from "../gateway.js";
import { parseTasksMarkdown, taskStats, type ParsedTasksFile, type ParsedTask, type TaskPriority } from "./tasks-parser.js";

// ─── Types ───────────────────────────────────────────────────────

interface SessionEntry {
  key: string;
  label?: string;
  displayName?: string;
  model?: string;
  totalTokens?: number;
  updatedAt?: number;
  messages?: Array<{
    role: string;
    content: Array<{ type: string; text?: string }>;
    stopReason?: string;
    errorMessage?: string;
    timestamp?: number;
  }>;
}

interface SessionsResult {
  count: number;
  sessions: SessionEntry[];
}

interface TasksViewState {
  client: GatewayBrowserClient | null;
  connected: boolean;
  tab: string;
}

// ─── Local State ────────────────────────────────────────────────

let parsedTasks: ParsedTasksFile | null = null;
let sessionsData: SessionsResult | null = null;
let loading = false;
let error: string | null = null;
let lastFetchTime = 0;

// ─── Data Fetching ──────────────────────────────────────────────

async function fetchData(state: TasksViewState): Promise<void> {
  if (!state.client || !state.connected) { return; }
  if (loading) { return; }
  if (Date.now() - lastFetchTime < 10_000 && parsedTasks) { return; }

  loading = true;
  error = null;
  try {
    // Fetch both in parallel
    const [tasksRes, sessionsRes] = await Promise.all([
      state.client.request("workspace.read", { file: "TASKS.md" })
        .catch(() => null) as Promise<{ file: string; content: string | null } | null>,
      state.client.request("sessions.list", {
        activeMinutes: 0, limit: 50, messageLimit: 1,
        includeGlobal: false, includeUnknown: false,
      }).catch(() => null) as Promise<SessionsResult | null>,
    ]);

    if (tasksRes?.content) {
      parsedTasks = parseTasksMarkdown(tasksRes.content);
    }
    if (sessionsRes) {
      sessionsData = sessionsRes;
    }
    lastFetchTime = Date.now();
  } catch (err) {
    error = String(err);
  } finally {
    loading = false;
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function getSessionStatus(session: SessionEntry): "running" | "completed" | "error" {
  const msgs = session.messages ?? [];
  const lastMsg = msgs[msgs.length - 1];
  if (lastMsg?.errorMessage) { return "error"; }
  if (lastMsg?.stopReason === "toolUse") { return "running"; }
  return "completed";
}

function getLastMessage(session: SessionEntry): string {
  const msgs = session.messages ?? [];
  for (const msg of msgs) {
    if (msg.role === "assistant" && msg.content) {
      for (const block of msg.content) {
        if (block.type === "text" && block.text) {
          const text = block.text;
          return text.length > 160 ? text.slice(0, 160) + "…" : text;
        }
      }
    }
  }
  return "";
}

function formatTimeAgo(timestamp: number | undefined): string {
  if (!timestamp) { return ""; }
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) { return "just now"; }
  if (minutes < 60) { return `${minutes}m ago`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${hours}h ago`; }
  return `${Math.floor(hours / 24)}d ago`;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: "#e53e3e",
  high: "#ed8936",
  medium: "#ecc94b",
  low: "#48bb78",
  backlog: "#a0aec0",
  waiting: "#9f7aea",
};

const PRIORITY_EMOJI: Record<TaskPriority, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
  backlog: "⚪",
  waiting: "📋",
};

// ─── Render Functions ───────────────────────────────────────────

function renderTaskCard(task: ParsedTask) {
  const color = PRIORITY_COLORS[task.priority];
  const totalItems = task.completed.length + task.pending.length + task.inProgress.length;
  const doneItems = task.completed.length;
  const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : -1;

  return html`
    <div style="
      padding: 0.75rem 1rem;
      margin-bottom: 0.5rem;
      border-radius: 8px;
      background: var(--color-surface, #1a1a2e);
      border: 1px solid var(--color-border, #2a2a3e);
      border-left: 3px solid ${color};
      ${task.isCompleted ? "opacity: 0.6;" : ""}
    ">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.15rem;">
            ${task.isCompleted ? "✅" : ""} ${task.title}
          </div>
          <div style="font-size: 0.7rem; color: var(--color-muted, #666); font-family: monospace;">
            ${task.id}
          </div>
        </div>
      </div>
      ${task.status ? html`
        <div style="font-size: 0.75rem; color: var(--color-secondary, #aaa); margin-top: 0.35rem;">
          ${task.status}
        </div>
      ` : nothing}
      ${task.description ? html`
        <div style="font-size: 0.8rem; color: var(--color-secondary, #999); margin-top: 0.35rem; line-height: 1.4;">
          ${task.description.slice(0, 200)}${task.description.length > 200 ? "…" : ""}
        </div>
      ` : nothing}
      ${progressPct >= 0 ? html`
        <div style="margin-top: 0.5rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--color-muted, #888); margin-bottom: 0.2rem;">
            <span>${doneItems}/${totalItems} items</span>
            <span>${progressPct}%</span>
          </div>
          <div style="height: 4px; border-radius: 2px; background: var(--color-border, #2a2a3e); overflow: hidden;">
            <div style="height: 100%; width: ${progressPct}%; background: ${color}; border-radius: 2px; transition: width 0.3s;"></div>
          </div>
        </div>
      ` : nothing}
    </div>
  `;
}

function renderSessionCard(session: SessionEntry) {
  const status = getSessionStatus(session);
  const statusEmoji = status === "running" ? "🔄" : status === "error" ? "❌" : "✅";
  const label = session.label || session.displayName || session.key;
  const lastMsg = getLastMessage(session);
  const timeAgo = formatTimeAgo(session.updatedAt);

  return html`
    <div style="
      padding: 0.6rem 0.75rem;
      margin-bottom: 0.4rem;
      border-radius: 6px;
      background: var(--color-surface, #1a1a2e);
      border: 1px solid var(--color-border, #2a2a3e);
      ${status === "running" ? "border-left: 3px solid var(--color-accent, #4a9eff);" : ""}
      ${status === "error" ? "border-left: 3px solid #e53e3e;" : ""}
      font-size: 0.8rem;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600;">${statusEmoji} ${label}</span>
        <span style="font-size: 0.7rem; color: var(--color-muted, #888);">${timeAgo}</span>
      </div>
      ${lastMsg ? html`
        <div style="font-size: 0.75rem; color: var(--color-secondary, #aaa); margin-top: 0.2rem; overflow: hidden; max-height: 2.5em;">
          ${lastMsg}
        </div>
      ` : nothing}
    </div>
  `;
}

function renderStatsBar(stats: ReturnType<typeof taskStats>, subAgentCount: number) {
  const items = [
    { label: "Active", value: stats.active, color: "var(--color-accent, #4a9eff)" },
    { label: "Done", value: stats.completed, color: "#48bb78" },
    { label: "Critical", value: stats.critical, color: "#e53e3e" },
    { label: "Sub-Agents", value: subAgentCount, color: "#9f7aea" },
    { label: "Waiting", value: stats.waitingOnDave, color: "#ed8936" },
  ];

  return html`
    <div style="display: flex; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap;">
      ${items.filter(i => i.value > 0).map(item => html`
        <div style="
          padding: 0.5rem 1rem; border-radius: 8px;
          background: var(--color-surface, #1a1a2e);
          border: 1px solid var(--color-border, #2a2a3e);
          text-align: center; min-width: 80px;
        ">
          <div style="font-size: 1.25rem; font-weight: 700; color: ${item.color};">${item.value}</div>
          <div style="font-size: 0.65rem; color: var(--color-muted, #888); text-transform: uppercase; letter-spacing: 0.03em;">${item.label}</div>
        </div>
      `)}
    </div>
  `;
}

function renderTasksBoard(state: TasksViewState) {
  void fetchData(state);

  if (loading && !parsedTasks && !sessionsData) {
    return html`<div style="padding: 2rem; color: var(--color-muted, #888);">Loading...</div>`;
  }

  if (error && !parsedTasks && !sessionsData) {
    return html`<div style="padding: 2rem; color: var(--color-error, #e53e3e);">Error: ${error}</div>`;
  }

  const sessions = sessionsData?.sessions ?? [];
  const subAgents = sessions.filter((s) => s.key.includes("subagent"));
  const running = subAgents.filter((s) => getSessionStatus(s) === "running");
  const stats = parsedTasks ? taskStats(parsedTasks) : null;

  return html`
    <div style="padding: 1.25rem; max-width: 1200px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.25rem;">📋 Tasks & Activity</h2>
          ${parsedTasks?.lastUpdated ? html`
            <div style="font-size: 0.7rem; color: var(--color-muted, #666); margin-top: 0.2rem;">
              TASKS.md updated: ${parsedTasks.lastUpdated}
            </div>
          ` : nothing}
        </div>
      </div>

      <!-- Stats bar -->
      ${stats ? renderStatsBar(stats, subAgents.length) : nothing}

      <!-- Two-column layout -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; align-items: start;">

        <!-- Left: Task sections -->
        <div>
          ${parsedTasks ? parsedTasks.sections.map(section => html`
            <div style="margin-bottom: 1rem;">
              <h3 style="
                margin: 0 0 0.5rem 0;
                font-size: 0.8rem;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: ${PRIORITY_COLORS[section.priority]};
              ">
                ${PRIORITY_EMOJI[section.priority]} ${section.label} (${section.tasks.length})
              </h3>
              ${section.tasks.map(renderTaskCard)}
            </div>
          `) : html`
            <div style="padding: 1rem; color: var(--color-muted, #888); text-align: center;">
              TASKS.md not available yet.<br>
              <span style="font-size: 0.8rem;">The workspace.read API will serve it once the dev gateway starts.</span>
            </div>
          `}

          ${parsedTasks && parsedTasks.waitingOnDave.length > 0 ? html`
            <div style="margin-top: 1rem;">
              <h3 style="
                margin: 0 0 0.5rem 0;
                font-size: 0.8rem;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: ${PRIORITY_COLORS.waiting};
              ">
                📋 Waiting on Dave (${parsedTasks.waitingOnDave.length})
              </h3>
              ${parsedTasks.waitingOnDave.map(item => html`
                <div style="
                  padding: 0.4rem 0.75rem;
                  margin-bottom: 0.25rem;
                  border-radius: 6px;
                  background: var(--color-surface, #1a1a2e);
                  border: 1px solid var(--color-border, #2a2a3e);
                  font-size: 0.8rem;
                  color: var(--color-secondary, #aaa);
                ">
                  ☐ ${item}
                </div>
              `)}
            </div>
          ` : nothing}
        </div>

        <!-- Right: Sub-agent activity -->
        <div>
          ${running.length > 0 ? html`
            <h3 style="
              margin: 0 0 0.5rem 0;
              font-size: 0.8rem;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: var(--color-accent, #4a9eff);
            ">
              🔄 Active Sub-Agents (${running.length})
            </h3>
            ${running.map(renderSessionCard)}
          ` : nothing}

          <h3 style="
            margin: ${running.length > 0 ? "1rem" : "0"} 0 0.5rem 0;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--color-muted, #888);
          ">
            Recent Sessions (${sessions.length})
          </h3>
          ${sessions.slice(0, 15).map(renderSessionCard)}
          ${sessions.length > 15 ? html`
            <div style="font-size: 0.75rem; color: var(--color-muted, #666); text-align: center; padding: 0.5rem;">
              +${sessions.length - 15} more in Sessions tab
            </div>
          ` : nothing}
        </div>
      </div>
    </div>
  `;
}

// ─── Registration ───────────────────────────────────────────────

featureRegistry.register({
  id: "tasks",
  tab: {
    group: "Work",
    path: "/tasks",
    icon: "fileText",
    title: "Tasks",
    subtitle: "Track active work, projects, and sub-agent status.",
  },
  render: (state) => renderTasksBoard(state as TasksViewState),
  enabled: false,  // OFF by default — flip to true in dev
});
