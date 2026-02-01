/**
 * TASKS.md Parser
 *
 * Parses the Gordon TASKS.md format into structured data
 * for the tasks board. Pure function, no dependencies.
 *
 * Format:
 *   ## 🔴 Priority: Critical (...)
 *   ### TASK-ID: Title
 *   - **Status:** ...
 *   - **Source:** ...
 *   - **Description:** ...
 *   - other fields...
 */

export type TaskPriority = "critical" | "high" | "medium" | "low" | "backlog" | "waiting";

export interface ParsedTask {
  id: string;            // "FORK-001"
  title: string;         // "Establish Clawdbot Fork"
  priority: TaskPriority;
  status: string;        // raw status line text
  source?: string;
  description?: string;
  body: string;          // full markdown body of the task block
  completed: string[];   // list of ✅ items
  pending: string[];     // list of ⬜ items
  inProgress: string[];  // list of 🔄 items
  isCompleted: boolean;  // true if status starts with ✅
}

export interface ParsedTasksFile {
  lastUpdated: string | null;
  sections: {
    priority: TaskPriority;
    label: string;
    tasks: ParsedTask[];
  }[];
  waitingOnDave: string[];
}

const PRIORITY_MAP: Record<string, TaskPriority> = {
  "critical": "critical",
  "high": "high",
  "medium": "medium",
  "low": "low",
  "backlog": "backlog",
};

function detectPriority(headerText: string): { priority: TaskPriority; label: string } | null {
  // Match "## 🔴 Priority: Critical (...)" or "## 📋 Waiting on Dave"
  const priorityMatch = headerText.match(/##\s+\S+\s+Priority:\s*(\w+)\s*(.*)/i);
  if (priorityMatch) {
    const key = priorityMatch[1].toLowerCase();
    const priority = PRIORITY_MAP[key] ?? "backlog";
    const extra = priorityMatch[2] ? ` ${priorityMatch[2]}` : "";
    return { priority, label: `${priorityMatch[1]}${extra}` };
  }
  if (/waiting\s+on/i.test(headerText)) {
    return { priority: "waiting", label: "Waiting on Dave" };
  }
  return null;
}

function parseTaskBlock(block: string, priority: TaskPriority): ParsedTask | null {
  const lines = block.split("\n");
  const headerLine = lines[0];

  // Match "### TASK-ID: Title" or "### TASK-ID Title"
  const headerMatch = headerLine.match(/^###\s+(\S+?):\s+(.+)/);
  if (!headerMatch) { return null; }

  const id = headerMatch[1];
  const title = headerMatch[2].trim();
  const body = lines.slice(1).join("\n").trim();

  // Extract fields
  let status = "";
  let source = "";
  let description = "";
  const completed: string[] = [];
  const pending: string[] = [];
  const inProgress: string[] = [];

  for (const line of lines) {
    const statusMatch = line.match(/-\s+\*\*Status:\*\*\s*(.*)/);
    if (statusMatch) { status = statusMatch[1].trim(); }

    const sourceMatch = line.match(/-\s+\*\*Source:\*\*\s*(.*)/);
    if (sourceMatch) { source = sourceMatch[1].trim(); }

    const descMatch = line.match(/-\s+\*\*Description:\*\*\s*(.*)/);
    if (descMatch) { description = descMatch[1].trim(); }

    if (/^\s+-\s*✅/.test(line)) { completed.push(line.replace(/^\s+-\s*✅\s*/, "").trim()); }
    if (/^\s+-\s*⬜/.test(line)) { pending.push(line.replace(/^\s+-\s*⬜\s*/, "").trim()); }
    if (/^\s+-\s*🔄/.test(line)) { inProgress.push(line.replace(/^\s+-\s*🔄\s*/, "").trim()); }
  }

  const isCompleted = /^✅/.test(status) || /COMPLETE/i.test(status);

  return {
    id,
    title,
    priority,
    status,
    source: source || undefined,
    description: description || undefined,
    body,
    completed,
    pending,
    inProgress,
    isCompleted,
  };
}

export function parseTasksMarkdown(markdown: string): ParsedTasksFile {
  const result: ParsedTasksFile = {
    lastUpdated: null,
    sections: [],
    waitingOnDave: [],
  };

  // Extract last updated
  const updatedMatch = markdown.match(/Last updated:\s*(.+)/i);
  if (updatedMatch) {
    result.lastUpdated = updatedMatch[1].trim();
  }

  // Split by ## headers
  const sectionSplits = markdown.split(/(?=^## )/m);

  for (const section of sectionSplits) {
    const firstLine = section.split("\n")[0];
    const detected = detectPriority(firstLine);
    if (!detected) { continue; }

    if (detected.priority === "waiting") {
      // Parse checklist items
      const checklistItems = section.match(/^-\s+\[.\]\s+(.+)/gm);
      if (checklistItems) {
        result.waitingOnDave = checklistItems.map((item) =>
          item.replace(/^-\s+\[.\]\s+/, "").trim()
        );
      }
      continue;
    }

    // Split section into task blocks (by ### headers)
    const taskBlocks = section.split(/(?=^### )/m).slice(1); // skip section header

    const tasks: ParsedTask[] = [];
    for (const block of taskBlocks) {
      const parsed = parseTaskBlock(block.trim(), detected.priority);
      if (parsed) { tasks.push(parsed); }
    }

    if (tasks.length > 0) {
      result.sections.push({
        priority: detected.priority,
        label: detected.label,
        tasks,
      });
    }
  }

  return result;
}

/**
 * Quick summary stats from parsed tasks
 */
export function taskStats(parsed: ParsedTasksFile) {
  const allTasks = parsed.sections.flatMap((s) => s.tasks);
  return {
    total: allTasks.length,
    completed: allTasks.filter((t) => t.isCompleted).length,
    active: allTasks.filter((t) => !t.isCompleted).length,
    critical: parsed.sections.find((s) => s.priority === "critical")?.tasks.filter((t) => !t.isCompleted).length ?? 0,
    waitingOnDave: parsed.waitingOnDave.length,
  };
}
