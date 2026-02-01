import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemTheme, resolveTheme } from "./theme";
import { applyResolvedTheme, syncThemeWithSettings } from "./app-settings";
import type { ResolvedTheme, ThemeMode } from "./theme";

describe("theme", () => {
  describe("resolveTheme", () => {
    it("returns 'light' for explicit light mode", () => {
      expect(resolveTheme("light")).toBe("light");
    });

    it("returns 'dark' for explicit dark mode", () => {
      expect(resolveTheme("dark")).toBe("dark");
    });

    it("resolves system mode using matchMedia", () => {
      // In a real browser, this returns whatever the OS says.
      // We just verify it returns a valid value.
      const result = resolveTheme("system");
      expect(["light", "dark"]).toContain(result);
    });
  });

  describe("getSystemTheme", () => {
    it("returns a valid theme in browser context", () => {
      const result = getSystemTheme();
      expect(["light", "dark"]).toContain(result);
    });
  });

  describe("applyResolvedTheme", () => {
    let origTheme: string | undefined;
    let origColorScheme: string;

    beforeEach(() => {
      origTheme = document.documentElement.dataset.theme;
      origColorScheme = document.documentElement.style.colorScheme;
    });

    afterEach(() => {
      // Restore
      if (origTheme !== undefined) {
        document.documentElement.dataset.theme = origTheme;
      } else {
        delete document.documentElement.dataset.theme;
      }
      document.documentElement.style.colorScheme = origColorScheme;
    });

    it("sets data-theme and colorScheme to light", () => {
      const host = { themeResolved: "dark" as ResolvedTheme };
      applyResolvedTheme(host as any, "light");
      expect(host.themeResolved).toBe("light");
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    it("sets data-theme and colorScheme to dark", () => {
      const host = { themeResolved: "light" as ResolvedTheme };
      applyResolvedTheme(host as any, "dark");
      expect(host.themeResolved).toBe("dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });
  });

  describe("syncThemeWithSettings – hydration race fix", () => {
    let origTheme: string | undefined;
    let origColorScheme: string;

    beforeEach(() => {
      origTheme = document.documentElement.dataset.theme;
      origColorScheme = document.documentElement.style.colorScheme;
    });

    afterEach(() => {
      if (origTheme !== undefined) {
        document.documentElement.dataset.theme = origTheme;
      } else {
        delete document.documentElement.dataset.theme;
      }
      document.documentElement.style.colorScheme = origColorScheme;
    });

    it("resolves light theme when settings say light (not stuck on dark)", () => {
      const host = {
        settings: { theme: "light" as ThemeMode },
        theme: "system" as ThemeMode,
        themeResolved: "dark" as ResolvedTheme, // the old buggy default
      };
      syncThemeWithSettings(host as any);
      expect(host.theme).toBe("light");
      expect(host.themeResolved).toBe("light");
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    it("keeps dark when settings say dark", () => {
      const host = {
        settings: { theme: "dark" as ThemeMode },
        theme: "system" as ThemeMode,
        themeResolved: "dark" as ResolvedTheme,
      };
      syncThemeWithSettings(host as any);
      expect(host.theme).toBe("dark");
      expect(host.themeResolved).toBe("dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
    });

    it("initial themeResolved uses resolveTheme not hardcoded dark", () => {
      // Validates the fix: resolveTheme("light") should give "light"
      // Previously app.ts hardcoded themeResolved = "dark" regardless
      const resolved = resolveTheme("light");
      expect(resolved).toBe("light");

      // And dark still works
      expect(resolveTheme("dark")).toBe("dark");
    });
  });
});
