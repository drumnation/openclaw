import { describe, expect, it } from "vitest";
import { parseTasksMarkdown, taskStats } from "./tasks-parser";

const SAMPLE_TASKS_MD = `# TASKS.md — Gordon's Active Task List

Last updated: 2026-02-01 09:35 EST

---

## 🔴 Priority: Critical (Blocking / High Impact)

### CLAWDBOT-001: Webchat Image Upload — Event Gap Bug
- **Status:** Open — needs investigation
- **Source:** Dave reported 2026-02-01
- **Description:** Uploading images triggers event gap error

### CME-001: Tuesday Demo Prep
- **Status:** PAUSED till Monday
- **Source:** From session notes

---

## 🟠 Priority: High (Clawdbot Engine Improvements)

### FORK-001: Establish Clawdbot Fork
- **Status:** ✅ PHASE 2 COMPLETE — Feature registry built
- **Source:** Dave 2026-02-01
- **Completed:**
  - ✅ Fork created
  - ✅ Upstream remote configured
  - 🔄 Task dispatch
  - ⬜ Quality gates
  - ⬜ Full pipeline test

### CLAWDBOT-003: Task Board / Kanban UI
- **Status:** Open — design phase
- **Description:** Add a Tasks tab to control panel

---

## 🟡 Priority: Medium (Active Projects)

### BG9-001: Finish Execution Pipeline
- **Status:** In progress
- **Description:** Complete BG 9.0 dispatch

---

## 🟢 Priority: Low / Backlog

### INFRA-001: Memory Search API Key
- **Status:** Broken
- **Description:** OpenAI embeddings API key expired

---

## 📋 Waiting on Dave

- [ ] OneMain payoff status
- [ ] Jaclyn payment status
- [ ] Capital One $4K autopay status
`;

describe("parseTasksMarkdown", () => {
  const parsed = parseTasksMarkdown(SAMPLE_TASKS_MD);

  it("extracts last updated timestamp", () => {
    expect(parsed.lastUpdated).toBe("2026-02-01 09:35 EST");
  });

  it("parses all priority sections", () => {
    expect(parsed.sections).toHaveLength(4);
    expect(parsed.sections.map((s) => s.priority)).toEqual([
      "critical", "high", "medium", "low",
    ]);
  });

  it("parses critical tasks", () => {
    const critical = parsed.sections[0];
    expect(critical.tasks).toHaveLength(2);
    expect(critical.tasks[0].id).toBe("CLAWDBOT-001");
    expect(critical.tasks[0].title).toBe("Webchat Image Upload — Event Gap Bug");
    expect(critical.tasks[0].status).toBe("Open — needs investigation");
    expect(critical.tasks[0].source).toBe("Dave reported 2026-02-01");
    expect(critical.tasks[0].description).toBe("Uploading images triggers event gap error");
    expect(critical.tasks[0].isCompleted).toBe(false);
  });

  it("detects completed tasks", () => {
    const high = parsed.sections[1];
    const fork = high.tasks.find((t) => t.id === "FORK-001");
    expect(fork).toBeDefined();
    expect(fork!.isCompleted).toBe(true);
    expect(fork!.completed).toEqual(["Fork created", "Upstream remote configured"]);
    expect(fork!.inProgress).toEqual(["Task dispatch"]);
    expect(fork!.pending).toEqual(["Quality gates", "Full pipeline test"]);
  });

  it("parses waiting on Dave items", () => {
    expect(parsed.waitingOnDave).toEqual([
      "OneMain payoff status",
      "Jaclyn payment status",
      "Capital One $4K autopay status",
    ]);
  });

  it("computes task stats", () => {
    const stats = taskStats(parsed);
    expect(stats.total).toBe(6);
    expect(stats.completed).toBe(1);
    expect(stats.active).toBe(5);
    expect(stats.critical).toBe(2);
    expect(stats.waitingOnDave).toBe(3);
  });
});

describe("edge cases", () => {
  it("handles empty markdown", () => {
    const parsed = parseTasksMarkdown("");
    expect(parsed.sections).toEqual([]);
    expect(parsed.lastUpdated).toBeNull();
    expect(parsed.waitingOnDave).toEqual([]);
  });

  it("handles markdown with no tasks", () => {
    const parsed = parseTasksMarkdown("# Just a title\n\nSome text.");
    expect(parsed.sections).toEqual([]);
  });

  it("skips malformed task headers", () => {
    const md = `## 🔴 Priority: Critical\n\n### Not a proper format\nSome text\n\n### TASK-001: Valid Task\n- **Status:** Open`;
    const parsed = parseTasksMarkdown(md);
    expect(parsed.sections[0].tasks).toHaveLength(1);
    expect(parsed.sections[0].tasks[0].id).toBe("TASK-001");
  });
});
