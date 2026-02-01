/**
 * Workspace file reader — exposes safe, read-only access to workspace files.
 *
 * Currently supports reading specific known files (TASKS.md, MEMORY.md, etc.)
 * from the agent's workspace directory.
 *
 * Security: Only allows reading files that match an explicit allowlist.
 * No directory traversal, no writes, no arbitrary paths.
 */
import { readFile } from "node:fs/promises";
import { join, resolve, normalize } from "node:path";
import type { GatewayRequestHandlers } from "./types.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

/**
 * Allowlisted file patterns that can be read via this API.
 * Add new patterns here as features need them.
 */
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

/** Check if a relative path is in the allowlist */
function isAllowed(relativePath: string): boolean {
  const normalized = normalize(relativePath);
  // Block path traversal
  if (normalized.startsWith("..") || normalized.includes("/..") || normalized.includes("\\..")) {
    return false;
  }
  // Check exact match
  if (ALLOWED_FILES.has(normalized)) {
    return true;
  }
  // Allow docs/features/** (GROVE planning docs)
  if (normalized.startsWith("docs/features/") && normalized.endsWith(".md")) {
    return true;
  }
  // Allow memory/** (daily notes)
  if (normalized.startsWith("memory/") && normalized.endsWith(".md")) {
    return true;
  }
  return false;
}

export const workspaceHandlers: GatewayRequestHandlers = {
  "workspace.read": async ({ params, respond }) => {
    const filePath = params?.file;
    if (typeof filePath !== "string" || !filePath) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing 'file' parameter"));
      return;
    }
    if (!isAllowed(filePath)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `file not in allowlist: ${filePath}`),
      );
      return;
    }
    try {
      const cfg = loadConfig();
      const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
      const fullPath = resolve(join(workspaceDir, filePath));
      // Double-check the resolved path is inside workspace (defense in depth)
      if (!fullPath.startsWith(resolve(workspaceDir))) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path escapes workspace"));
        return;
      }
      const content = await readFile(fullPath, "utf-8");
      respond(true, { file: filePath, content }, undefined);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        respond(true, { file: filePath, content: null }, undefined);
        return;
      }
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `failed to read file: ${String(err)}`),
      );
    }
  },

  "workspace.list": async ({ params, respond }) => {
    // List available workspace files in a directory
    const dir = typeof params?.dir === "string" ? params.dir : "";
    if (dir && !isAllowed(dir + "/dummy.md")) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `directory not allowed: ${dir}`),
      );
      return;
    }
    try {
      const cfg = loadConfig();
      const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
      const targetDir = dir ? resolve(join(workspaceDir, dir)) : workspaceDir;
      if (!targetDir.startsWith(resolve(workspaceDir))) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path escapes workspace"));
        return;
      }
      const { readdir } = await import("node:fs/promises");
      const entries = await readdir(targetDir, { withFileTypes: true });
      const files = entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name);
      respond(true, { dir: dir || ".", files }, undefined);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        respond(true, { dir: dir || ".", files: [] }, undefined);
        return;
      }
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `failed to list: ${String(err)}`),
      );
    }
  },
};
