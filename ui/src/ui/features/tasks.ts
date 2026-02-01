/**
 * Tasks Feature — Project & Sub-Agent Status Board
 *
 * Displays active sub-agents, their status, and provides
 * a quick overview of what Gordon is working on.
 *
 * MVP: Sessions-based view of sub-agent activity.
 * Future: Parse TASKS.md, GROVE doc links, full Kanban.
 */
import { html, nothing } from "lit";
import { featureRegistry } from "../feature-registry.js";
import type { GatewayBrowserClient } from "../gateway.js";

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

interface TasksState {
  client: GatewayBrowserClient | null;
  connected: boolean;
  tab: string;
}

// Local state for the tasks feature
let tasksData: SessionsResult | null = null;
let tasksLoading = false;
let tasksError: string | null = null;
let lastFetchTime = 0;

async function fetchSessions(state: TasksState): Promise<void> {
  if (!state.client || !state.connected) { return; }
  if (tasksLoading) { return; }

  // Don't refetch if we fetched less than 10s ago
  if (Date.now() - lastFetchTime < 10_000 && tasksData) { return; }

  tasksLoading = true;
  tasksError = null;
  try {
    const res = await state.client.request("sessions.list", {
      activeMinutes: 0,  // all sessions
      limit: 50,
      messageLimit: 1,
      includeGlobal: false,
      includeUnknown: false,
    }) as SessionsResult | undefined;
    if (res) {
      tasksData = res;
      lastFetchTime = Date.now();
    }
  } catch (err) {
    tasksError = String(err);
  } finally {
    tasksLoading = false;
  }
}

function getLastMessage(session: SessionEntry): string {
  const msgs = session.messages ?? [];
  for (const msg of msgs) {
    if (msg.role === "assistant" && msg.content) {
      for (const block of msg.content) {
        if (block.type === "text" && block.text) {
          return block.text.slice(0, 200) + (block.text.length > 200 ? "…" : "");
        }
      }
    }
  }
  return "";
}

function getSessionStatus(session: SessionEntry): "running" | "completed" | "error" {
  const msgs = session.messages ?? [];
  const lastMsg = msgs[msgs.length - 1];
  if (lastMsg?.errorMessage) { return "error"; }
  if (lastMsg?.stopReason === "stop" || lastMsg?.stopReason === "end_turn") { return "completed"; }
  if (lastMsg?.stopReason === "toolUse") { return "running"; }
  return "completed";
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

function renderSessionCard(session: SessionEntry) {
  const status = getSessionStatus(session);
  const statusEmoji = status === "running" ? "🔄" : status === "error" ? "❌" : "✅";
  const label = session.label || session.displayName || session.key;
  const lastMsg = getLastMessage(session);
  const timeAgo = formatTimeAgo(session.updatedAt);
  const isSubAgent = session.key.includes("subagent");
  const isMain = session.key === "agent:main:main";

  return html`
    <div style="
      padding: 0.75rem 1rem;
      margin-bottom: 0.5rem;
      border-radius: 8px;
      background: var(--color-surface, #1a1a2e);
      border: 1px solid var(--color-border, #2a2a3e);
      ${status === "running" ? "border-left: 3px solid var(--color-accent, #4a9eff);" : ""}
      ${status === "error" ? "border-left: 3px solid #e53e3e;" : ""}
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
        <span style="font-weight: 600; font-size: 0.9rem;">
          ${statusEmoji} ${label}
        </span>
        <span style="font-size: 0.75rem; color: var(--color-muted, #888);">
          ${timeAgo}
        </span>
      </div>
      ${isMain ? html`
        <div style="font-size: 0.75rem; color: var(--color-muted, #888); margin-bottom: 0.25rem;">
          Main session
        </div>
      ` : isSubAgent ? html`
        <div style="font-size: 0.75rem; color: var(--color-muted, #888); margin-bottom: 0.25rem;">
          Sub-agent${session.model ? html` · <code style="font-size: 0.7rem;">${session.model}</code>` : nothing}
        </div>
      ` : nothing}
      ${lastMsg ? html`
        <div style="font-size: 0.8rem; color: var(--color-secondary, #aaa); line-height: 1.4; overflow: hidden; max-height: 3.5em;">
          ${lastMsg}
        </div>
      ` : nothing}
    </div>
  `;
}

function renderTasksBoard(state: TasksState) {
  // Trigger fetch on render
  void fetchSessions(state);

  if (tasksLoading && !tasksData) {
    return html`<div style="padding: 2rem; color: var(--color-muted, #888);">Loading sessions...</div>`;
  }

  if (tasksError) {
    return html`<div style="padding: 2rem; color: var(--color-error, #e53e3e);">Error: ${tasksError}</div>`;
  }

  if (!tasksData || tasksData.sessions.length === 0) {
    return html`<div style="padding: 2rem; color: var(--color-muted, #888);">No sessions found.</div>`;
  }

  const sessions = tasksData.sessions;
  const subAgents = sessions.filter((s) => s.key.includes("subagent"));
  const running = subAgents.filter((s) => getSessionStatus(s) === "running");
  const completed = subAgents.filter((s) => getSessionStatus(s) === "completed");
  const errored = subAgents.filter((s) => getSessionStatus(s) === "error");
  const mainSession = sessions.find((s) => s.key === "agent:main:main");

  return html`
    <div style="padding: 1.5rem;">
      <!-- Summary stats -->
      <div style="
        display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
      ">
        <div style="
          padding: 0.75rem 1.25rem; border-radius: 8px;
          background: var(--color-surface, #1a1a2e);
          border: 1px solid var(--color-border, #2a2a3e);
          min-width: 120px; text-align: center;
        ">
          <div style="font-size: 1.5rem; font-weight: 700;">${subAgents.length}</div>
          <div style="font-size: 0.75rem; color: var(--color-muted, #888);">Sub-Agents Total</div>
        </div>
        <div style="
          padding: 0.75rem 1.25rem; border-radius: 8px;
          background: var(--color-surface, #1a1a2e);
          border: 1px solid var(--color-accent, #4a9eff);
          min-width: 120px; text-align: center;
        ">
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-accent, #4a9eff);">${running.length}</div>
          <div style="font-size: 0.75rem; color: var(--color-muted, #888);">Running</div>
        </div>
        <div style="
          padding: 0.75rem 1.25rem; border-radius: 8px;
          background: var(--color-surface, #1a1a2e);
          border: 1px solid #48bb78;
          min-width: 120px; text-align: center;
        ">
          <div style="font-size: 1.5rem; font-weight: 700; color: #48bb78;">${completed.length}</div>
          <div style="font-size: 0.75rem; color: var(--color-muted, #888);">Completed</div>
        </div>
        ${errored.length > 0 ? html`
          <div style="
            padding: 0.75rem 1.25rem; border-radius: 8px;
            background: var(--color-surface, #1a1a2e);
            border: 1px solid #e53e3e;
            min-width: 120px; text-align: center;
          ">
            <div style="font-size: 1.5rem; font-weight: 700; color: #e53e3e;">${errored.length}</div>
            <div style="font-size: 0.75rem; color: var(--color-muted, #888);">Errored</div>
          </div>
        ` : nothing}
      </div>

      <!-- Main session -->
      ${mainSession ? html`
        <h3 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted, #888);">
          Main Session
        </h3>
        ${renderSessionCard(mainSession)}
      ` : nothing}

      <!-- Running sub-agents -->
      ${running.length > 0 ? html`
        <h3 style="margin: 1rem 0 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-accent, #4a9eff);">
          🔄 Running (${running.length})
        </h3>
        ${running.map(renderSessionCard)}
      ` : nothing}

      <!-- Errored sub-agents -->
      ${errored.length > 0 ? html`
        <h3 style="margin: 1rem 0 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #e53e3e;">
          ❌ Errored (${errored.length})
        </h3>
        ${errored.map(renderSessionCard)}
      ` : nothing}

      <!-- Completed sub-agents -->
      ${completed.length > 0 ? html`
        <h3 style="margin: 1rem 0 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #48bb78;">
          ✅ Completed (${completed.length})
        </h3>
        ${completed.map(renderSessionCard)}
      ` : nothing}

      <!-- Footer note -->
      <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border, #2a2a3e); font-size: 0.75rem; color: var(--color-muted, #666);">
        MVP: Sub-agent status board. Future: TASKS.md parsing, GROVE doc links, full project board.
      </div>
    </div>
  `;
}

featureRegistry.register({
  id: "tasks",
  tab: {
    group: "Work",
    path: "/tasks",
    icon: "fileText",
    title: "Tasks",
    subtitle: "Track active work, projects, and sub-agent status.",
  },
  render: (state) => renderTasksBoard(state as TasksState),
  enabled: false,  // OFF by default — flip to true in dev
});
