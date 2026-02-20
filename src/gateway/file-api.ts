/**
 * File API endpoint for the control UI.
 * GET /api/file?path=<relative-or-absolute-path>
 * Returns JSON: { content, size, modified, mimeType, path }
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

const MAX_FILE_SIZE = 512 * 1024; // 512KB max

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".sh",
  ".css",
  ".html",
  ".htm",
  ".xml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
  ".gitignore",
  ".dockerignore",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".svg",
  ".csv",
  ".log",
  ".rs",
  ".go",
  ".rb",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".swift",
  ".kt",
  ".scala",
  ".sql",
  ".graphql",
  ".gql",
  ".proto",
  ".prisma",
  ".vue",
  ".svelte",
  ".astro",
]);

function getMimeType(ext: string): string {
  switch (ext) {
    case ".md":
      return "text/markdown";
    case ".json":
      return "application/json";
    case ".yaml":
    case ".yml":
      return "text/yaml";
    case ".html":
    case ".htm":
      return "text/html";
    case ".css":
      return "text/css";
    case ".js":
    case ".jsx":
      return "application/javascript";
    case ".ts":
    case ".tsx":
      return "application/typescript";
    case ".py":
      return "text/x-python";
    case ".sh":
      return "text/x-shellscript";
    case ".xml":
    case ".svg":
      return "application/xml";
    default:
      return "text/plain";
  }
}

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) {
    return true;
  }
  // Files without extension are often text (Makefile, Dockerfile, etc.)
  const basename = path.basename(filePath);
  if (
    !ext &&
    (basename === "Makefile" ||
      basename === "Dockerfile" ||
      basename === "Gemfile" ||
      basename === "Rakefile" ||
      basename === "LICENSE" ||
      basename === "README" ||
      basename === "CHANGELOG")
  ) {
    return true;
  }
  return false;
}

function sendJsonResponse(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end(JSON.stringify(body));
}

/**
 * Handle file API requests. Call from the main HTTP handler.
 * Returns true if the request was handled, false otherwise.
 */
export function handleFileApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { workspaceRoot?: string },
): boolean {
  const urlRaw = req.url;
  if (!urlRaw) {
    return false;
  }

  const url = new URL(urlRaw, "http://localhost");
  if (url.pathname !== "/api/file") {
    return false;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "text/plain");
    res.end("Method Not Allowed");
    return true;
  }

  const filePath = url.searchParams.get("path");
  if (!filePath) {
    sendJsonResponse(res, 400, { error: "Missing 'path' query parameter" });
    return true;
  }

  // Resolve the path relative to workspace root
  const workspaceRoot = opts.workspaceRoot ?? process.cwd();
  const resolved = path.resolve(workspaceRoot, filePath);

  // Security: ensure the resolved path is within the workspace root
  if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
    sendJsonResponse(res, 403, { error: "Path is outside workspace" });
    return true;
  }

  // Check file exists
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    sendJsonResponse(res, 404, { error: "File not found" });
    return true;
  }

  if (!stat.isFile()) {
    sendJsonResponse(res, 400, { error: "Path is not a file" });
    return true;
  }

  if (!isTextFile(resolved)) {
    sendJsonResponse(res, 400, { error: "Not a supported text file" });
    return true;
  }

  if (stat.size > MAX_FILE_SIZE) {
    sendJsonResponse(res, 413, {
      error: `File too large (${stat.size} bytes, max ${MAX_FILE_SIZE})`,
      size: stat.size,
      modified: stat.mtime.toISOString(),
      path: filePath,
    });
    return true;
  }

  const ext = path.extname(resolved).toLowerCase();
  const content = fs.readFileSync(resolved, "utf-8");

  sendJsonResponse(res, 200, {
    content,
    size: stat.size,
    modified: stat.mtime.toISOString(),
    mimeType: getMimeType(ext),
    path: filePath,
  });
  return true;
}
