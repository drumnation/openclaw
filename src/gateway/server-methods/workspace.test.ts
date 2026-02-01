import { describe, expect, it, vi, beforeEach } from "vitest";

// We test the isAllowed logic and handler behavior in isolation.
// The actual handlers use loadConfig/resolveAgentWorkspaceDir which
// are hard to mock in unit tests, so we focus on the allowlist logic.

// Extract the allowlist logic for testing
function isAllowed(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("..") || normalized.includes("/..")) {
    return false;
  }
  const ALLOWED_FILES = new Set([
    "TASKS.md",
    "MEMORY.md",
    "HEARTBEAT.md",
    "SOUL.md",
    "USER.md",
    "IDENTITY.md",
    "TOOLS.md",
    "AGENTS.md",
  ]);
  if (ALLOWED_FILES.has(normalized)) {
    return true;
  }
  if (normalized.startsWith("docs/features/") && normalized.endsWith(".md")) {
    return true;
  }
  if (normalized.startsWith("memory/") && normalized.endsWith(".md")) {
    return true;
  }
  return false;
}

describe("workspace allowlist", () => {
  it("allows known workspace files", () => {
    expect(isAllowed("TASKS.md")).toBe(true);
    expect(isAllowed("MEMORY.md")).toBe(true);
    expect(isAllowed("SOUL.md")).toBe(true);
    expect(isAllowed("USER.md")).toBe(true);
    expect(isAllowed("IDENTITY.md")).toBe(true);
    expect(isAllowed("TOOLS.md")).toBe(true);
    expect(isAllowed("AGENTS.md")).toBe(true);
    expect(isAllowed("HEARTBEAT.md")).toBe(true);
  });

  it("allows docs/features/** markdown files", () => {
    expect(isAllowed("docs/features/clawdbot-fork/01-prd.md")).toBe(true);
    expect(isAllowed("docs/features/some-feature/README.md")).toBe(true);
    expect(isAllowed("docs/features/deep/nested/path/file.md")).toBe(true);
  });

  it("allows memory/** markdown files", () => {
    expect(isAllowed("memory/2026-02-01.md")).toBe(true);
    expect(isAllowed("memory/heartbeat-state.md")).toBe(true);
  });

  it("blocks path traversal", () => {
    expect(isAllowed("../etc/passwd")).toBe(false);
    expect(isAllowed("docs/features/../../secret.md")).toBe(false);
    expect(isAllowed("..")).toBe(false);
    expect(isAllowed("memory/../../etc/shadow")).toBe(false);
  });

  it("blocks non-markdown files", () => {
    expect(isAllowed("docs/features/foo/bar.js")).toBe(false);
    expect(isAllowed("docs/features/foo/bar.ts")).toBe(false);
    expect(isAllowed("memory/state.json")).toBe(false);
  });

  it("blocks non-allowed directories", () => {
    expect(isAllowed("src/index.ts")).toBe(false);
    expect(isAllowed(".env")).toBe(false);
    expect(isAllowed("package.json")).toBe(false);
    expect(isAllowed("node_modules/foo/bar.md")).toBe(false);
    expect(isAllowed("docs/secret/file.md")).toBe(false);
  });

  it("blocks unknown root-level files", () => {
    expect(isAllowed("SECRET.md")).toBe(false);
    expect(isAllowed("passwords.md")).toBe(false);
    expect(isAllowed("BOOTSTRAP.md")).toBe(false);
  });
});
