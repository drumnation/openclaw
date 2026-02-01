import { describe, expect, it, beforeEach } from "vitest";
import { featureRegistry } from "./feature-registry";
import { nothing } from "lit";

const makeDef = (id: string, enabled = true) => ({
  id,
  tab: {
    group: "Test",
    path: `/${id}`,
    icon: "folder" as const,
    title: id.charAt(0).toUpperCase() + id.slice(1),
    subtitle: `${id} description`,
  },
  render: () => nothing,
  enabled,
});

describe("FeatureRegistry", () => {
  beforeEach(() => {
    featureRegistry._reset();
  });

  it("starts empty", () => {
    expect(featureRegistry.getAll()).toEqual([]);
    expect(featureRegistry.getEnabledFeatures()).toEqual([]);
    expect(featureRegistry.getFeatureTabGroups()).toEqual([]);
  });

  it("registers a feature", () => {
    featureRegistry.register(makeDef("tasks"));
    expect(featureRegistry.getAll()).toHaveLength(1);
    expect(featureRegistry.getFeature("tasks")).toBeDefined();
    expect(featureRegistry.getFeature("tasks")?.id).toBe("tasks");
  });

  it("enables and disables features", () => {
    featureRegistry.register(makeDef("tasks", false));
    expect(featureRegistry.isEnabled("tasks")).toBe(false);
    expect(featureRegistry.getEnabledFeatures()).toHaveLength(0);

    featureRegistry.setEnabled("tasks", true);
    expect(featureRegistry.isEnabled("tasks")).toBe(true);
    expect(featureRegistry.getEnabledFeatures()).toHaveLength(1);

    featureRegistry.setEnabled("tasks", false);
    expect(featureRegistry.isEnabled("tasks")).toBe(false);
    expect(featureRegistry.getEnabledFeatures()).toHaveLength(0);
  });

  it("disabled features don't appear in tab groups", () => {
    featureRegistry.register(makeDef("tasks", false));
    featureRegistry.register(makeDef("grove", true));
    const groups = featureRegistry.getFeatureTabGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].tabs).toEqual(["grove"]);
  });

  it("groups features by declared group", () => {
    featureRegistry.register({ ...makeDef("tasks"), tab: { ...makeDef("tasks").tab, group: "Work" } });
    featureRegistry.register({ ...makeDef("grove"), tab: { ...makeDef("grove").tab, group: "Work" } });
    featureRegistry.register({ ...makeDef("dashboard"), tab: { ...makeDef("dashboard").tab, group: "Life" } });
    const groups = featureRegistry.getFeatureTabGroups();
    expect(groups).toHaveLength(2);
    const work = groups.find((g) => g.label === "Work");
    const life = groups.find((g) => g.label === "Life");
    expect(work?.tabs).toEqual(["tasks", "grove"]);
    expect(life?.tabs).toEqual(["dashboard"]);
  });

  it("catches registration errors gracefully", () => {
    // Missing id
    featureRegistry.register({ id: "", tab: makeDef("x").tab, render: () => nothing, enabled: true });
    expect(featureRegistry.getAll()).toHaveLength(0);

    // Missing tab
    featureRegistry.register({ id: "bad", tab: null as any, render: () => nothing, enabled: true });
    expect(featureRegistry.getAll()).toHaveLength(0);
  });

  it("duplicate registration overwrites cleanly", () => {
    featureRegistry.register(makeDef("tasks"));
    featureRegistry.register({ ...makeDef("tasks"), tab: { ...makeDef("tasks").tab, title: "Updated" } });
    expect(featureRegistry.getAll()).toHaveLength(1);
    expect(featureRegistry.getFeature("tasks")?.tab.title).toBe("Updated");
  });

  it("unregisters features", () => {
    featureRegistry.register(makeDef("tasks"));
    expect(featureRegistry.getAll()).toHaveLength(1);
    featureRegistry.unregister("tasks");
    expect(featureRegistry.getAll()).toHaveLength(0);
  });

  it("safeRender returns null for unknown features", () => {
    expect(featureRegistry.safeRender("nonexistent", {})).toBeNull();
  });

  it("safeRender returns null for disabled features", () => {
    featureRegistry.register(makeDef("tasks", false));
    expect(featureRegistry.safeRender("tasks", {})).toBeNull();
  });

  it("safeRender catches render errors", () => {
    featureRegistry.register({
      ...makeDef("broken"),
      render: () => { throw new Error("kaboom"); },
    });
    // Should not throw
    const result = featureRegistry.safeRender("broken", {});
    expect(result).toBeNull();
  });

  it("notifies listeners on changes", () => {
    let count = 0;
    featureRegistry.onChange(() => count++);
    featureRegistry.register(makeDef("tasks"));
    expect(count).toBe(1);
    featureRegistry.setEnabled("tasks", false);
    expect(count).toBe(2);
    featureRegistry.unregister("tasks");
    expect(count).toBe(3);
  });

  it("unsubscribes listeners", () => {
    let count = 0;
    const unsub = featureRegistry.onChange(() => count++);
    featureRegistry.register(makeDef("tasks"));
    expect(count).toBe(1);
    unsub();
    featureRegistry.register(makeDef("grove"));
    expect(count).toBe(1); // no longer listening
  });

  it("isEnabled returns false for unknown features", () => {
    expect(featureRegistry.isEnabled("nonexistent")).toBe(false);
  });
});
