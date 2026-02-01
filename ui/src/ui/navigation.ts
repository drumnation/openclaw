import { t } from "../i18n/index.ts";
import type { IconName } from "./icons.js";
import { featureRegistry } from "./feature-registry.js";

/** Core tabs — always present, never flagged */
const CORE_TAB_GROUPS = [
  { label: "chat", tabs: ["chat"] },
  {
    label: "control",
    tabs: ["overview", "channels", "instances", "sessions", "usage", "cron"],
  },
  { label: "agent", tabs: ["agents", "skills", "nodes"] },
  { label: "settings", tabs: ["config", "debug", "logs"] },
] as const;

/**
 * TAB_GROUPS merges core tabs with enabled feature registry tabs.
 * Feature groups are inserted before Settings.
 * When no features are enabled, this is identical to the original static array.
 */
export function getTabGroups(): readonly { label: string; tabs: readonly string[] }[] {
  const featureGroups = featureRegistry.getFeatureTabGroups();
  if (featureGroups.length === 0) { return CORE_TAB_GROUPS; }
  // Insert feature groups before Settings (last core group)
  const core = [...CORE_TAB_GROUPS];
  const settings = core.pop()!;
  return [...core, ...featureGroups, settings];
}

/** Backwards-compatible static reference — used by existing code and tests */
export const TAB_GROUPS = CORE_TAB_GROUPS;

export type CoreTab =
  | "overview"
  | "channels"
  | "instances"
  | "sessions"
  | "usage"
  | "cron"
  | "skills"
  | "nodes"
  | "chat"
  | "config"
  | "debug"
  | "logs";

/** Tab type includes core tabs + string escape hatch for feature registry tabs */
export type Tab = CoreTab | (string & {});

const TAB_PATHS: Record<CoreTab, string> = {
  overview: "/overview",
  channels: "/channels",
  instances: "/instances",
  sessions: "/sessions",
  usage: "/usage",
  cron: "/cron",
  skills: "/skills",
  nodes: "/nodes",
  chat: "/chat",
  config: "/config",
  debug: "/debug",
  logs: "/logs",
};

const CORE_PATH_TO_TAB = new Map(Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]));

/** Resolve path to tab, checking core tabs first, then feature registry */
function resolvePathToTab(path: string): Tab | null {
  const core = CORE_PATH_TO_TAB.get(path);
  if (core) { return core; }
  // Check feature registry
  for (const feature of featureRegistry.getEnabledFeatures()) {
    if (feature.tab.path === path) { return feature.id as Tab; }
  }
  return null;
}

export function normalizeBasePath(basePath: string): string {
  if (!basePath) {
    return "";
  }
  let base = basePath.trim();
  if (!base.startsWith("/")) {
    base = `/${base}`;
  }
  if (base === "/") {
    return "";
  }
  if (base.endsWith("/")) {
    base = base.slice(0, -1);
  }
  return base;
}

export function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  const corePath = TAB_PATHS[tab as CoreTab];
  if (corePath) { return base ? `${base}${corePath}` : corePath; }
  // Check feature registry
  const feature = featureRegistry.getFeature(tab);
  const featurePath = feature?.tab.path ?? `/${tab}`;
  return base ? `${base}${featurePath}` : featurePath;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let path = pathname || "/";
  if (base) {
    if (path === base) {
      path = "/";
    } else if (path.startsWith(`${base}/`)) {
      path = path.slice(base.length);
    }
  }
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) normalized = "/";
  if (normalized === "/") return "chat";
  return resolvePathToTab(normalized);
}

export function inferBasePathFromPathname(pathname: string): string {
  let normalized = normalizePath(pathname);
  if (normalized.endsWith("/index.html")) {
    normalized = normalizePath(normalized.slice(0, -"/index.html".length));
  }
  if (normalized === "/") {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }
  for (let i = 0; i < segments.length; i++) {
    const candidate = `/${segments.slice(i).join("/")}`.toLowerCase();
    if (resolvePathToTab(candidate) !== null) {
      const prefix = segments.slice(0, i);
      return prefix.length ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    case "agents":
      return "folder";
    case "chat":
      return "messageSquare";
    case "overview":
      return "barChart";
    case "channels":
      return "link";
    case "instances":
      return "radio";
    case "sessions":
      return "fileText";
    case "usage":
      return "barChart";
    case "cron":
      return "loader";
    case "skills":
      return "zap";
    case "nodes":
      return "monitor";
    case "config":
      return "settings";
    case "debug":
      return "bug";
    case "logs":
      return "scrollText";
    default: {
      const feature = featureRegistry.getFeature(tab);
      return feature?.tab.icon ?? "folder";
    }
  }
}

export function titleForTab(tab: Tab) {
  // Check feature registry first for non-core tabs
  const feature = featureRegistry.getFeature(tab);
  if (feature) return feature.tab.title;
  return t(`tabs.${tab}`);
}

export function subtitleForTab(tab: Tab) {
  const feature = featureRegistry.getFeature(tab);
  if (feature) return feature.tab.subtitle ?? "";
  return t(`subtitles.${tab}`);
}
