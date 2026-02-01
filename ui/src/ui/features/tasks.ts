/**
 * Tasks Feature — Project & Task Board
 *
 * Self-registering feature module.
 * Import this file to register; set enabled: true to activate.
 *
 * This is a placeholder — the real implementation will render
 * TASKS.md as a visual board with sub-agent status.
 */
import { html } from "lit";
import { featureRegistry } from "../feature-registry.js";

featureRegistry.register({
  id: "tasks",
  tab: {
    group: "Work",
    path: "/tasks",
    icon: "fileText",
    title: "Tasks",
    subtitle: "Track active work, projects, and sub-agent status.",
  },
  render: (_state) => html`
    <div class="page-section" style="padding: 2rem;">
      <h2 style="margin: 0 0 1rem 0;">📋 Tasks</h2>
      <p style="color: var(--color-muted, #888);">
        Task board coming soon. This tab will display TASKS.md as a visual
        board with project status, sub-agent activity, and GROVE planning
        artifact links.
      </p>
    </div>
  `,
  enabled: false,  // OFF by default — flip to true in dev
});
