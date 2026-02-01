import type { TemplateResult } from "lit";
import type { IconName } from "./icons.js";

/**
 * Feature Registry — AI Development Isolation System
 *
 * Every feature an agent builds MUST be independently flaggable.
 * If it can't be cleanly turned off, it's not properly isolated.
 * The flag is the test of isolation quality.
 *
 * Usage:
 *   // features/my-feature.ts
 *   import { featureRegistry } from "../feature-registry.js";
 *   featureRegistry.register({ id: "my-feature", ... });
 */

export interface FeatureTabDefinition {
  group: string;        // nav group label: "Work", "Life", etc.
  path: string;         // URL path: "/tasks"
  icon: IconName;       // icon name from icons.ts
  title: string;        // page title: "Tasks"
  subtitle: string;     // page subtitle description
}

export interface FeatureDefinition {
  id: string;                                              // unique key
  tab: FeatureTabDefinition;
  render: (state: unknown) => TemplateResult | typeof import("lit").nothing;
  enabled: boolean;                                        // default state
}

export interface TabGroup {
  label: string;
  tabs: readonly string[];
}

class FeatureRegistryImpl {
  private features = new Map<string, FeatureDefinition>();
  private listeners = new Set<() => void>();

  /**
   * Register a feature. Errors are caught and logged, never thrown.
   * Duplicate IDs overwrite the previous registration.
   */
  register(def: FeatureDefinition): void {
    try {
      if (!def.id || typeof def.id !== "string") {
        console.warn("[feature-registry] registration skipped: missing or invalid id");
        return;
      }
      if (!def.tab || !def.render) {
        console.warn(`[feature-registry] registration skipped for "${def.id}": missing tab or render`);
        return;
      }
      this.features.set(def.id, { ...def });
      this.notify();
    } catch (err) {
      console.error(`[feature-registry] failed to register "${def.id}":`, err);
    }
  }

  unregister(id: string): void {
    this.features.delete(id);
    this.notify();
  }

  isEnabled(id: string): boolean {
    return this.features.get(id)?.enabled ?? false;
  }

  setEnabled(id: string, enabled: boolean): void {
    const feature = this.features.get(id);
    if (feature) {
      feature.enabled = enabled;
      this.notify();
    }
  }

  getFeature(id: string): FeatureDefinition | undefined {
    return this.features.get(id);
  }

  getAll(): FeatureDefinition[] {
    return Array.from(this.features.values());
  }

  getEnabledFeatures(): FeatureDefinition[] {
    return this.getAll().filter((f) => f.enabled);
  }

  /**
   * Build tab groups for enabled features, organized by their declared group.
   * These get merged with core tab groups by navigation.ts.
   */
  getFeatureTabGroups(): TabGroup[] {
    const groups = new Map<string, string[]>();
    for (const feature of this.getEnabledFeatures()) {
      const groupName = feature.tab.group;
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(feature.id);
    }
    return Array.from(groups.entries()).map(([label, tabs]) => ({ label, tabs }));
  }

  /**
   * Safe render: wraps the feature's render function in error boundary.
   * Returns an error panel if the feature throws, not a crash.
   */
  safeRender(id: string, state: unknown): TemplateResult | null {
    const feature = this.features.get(id);
    if (!feature || !feature.enabled) { return null; }
    try {
      return feature.render(state) as TemplateResult;
    } catch (err) {
      console.error(`[feature-registry] render error for "${id}":`, err);
      // Return null — the caller should show a fallback error panel
      return null;
    }
  }

  /** Subscribe to registry changes (for reactive UI updates) */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* swallow */ }
    }
  }

  /** Reset for testing */
  _reset(): void {
    this.features.clear();
    this.listeners.clear();
  }
}

export const featureRegistry = new FeatureRegistryImpl();
