import { describe, expect, it } from "vitest";
import {
  extractMarkdownPaths,
  getFilename,
  normalizePath,
  transformPathsToLinks,
  MD_PATH_REGEX,
} from "./markdown-paths";

describe("markdown-paths", () => {
  describe("MD_PATH_REGEX", () => {
    it("matches common path patterns", () => {
      const testCases = [
        "~/clawd/TASKS.md",
        "docs/features/foo/01-prd.md",
        "/home/user/projects/file.md",
        "./local/file.md",
        "../parent/README.md",
        "Mac:~/Dev/project/file.md",
      ];

      for (const tc of testCases) {
        expect(tc.match(MD_PATH_REGEX)).toBeTruthy();
      }
    });

    it("does not match non-path patterns", () => {
      const nonMatches = [
        "just-a-file.md", // no /
        "no-extension/file", // no .md
        "hello world", // not a path
      ];

      for (const tc of nonMatches) {
        expect(tc.match(MD_PATH_REGEX)).toBeFalsy();
      }
    });
  });

  describe("extractMarkdownPaths", () => {
    it("extracts paths from text", () => {
      const text = "Check ~/clawd/TASKS.md and docs/features/foo.md for details.";
      const paths = extractMarkdownPaths(text);
      expect(paths).toEqual(["~/clawd/TASKS.md", "docs/features/foo.md"]);
    });

    it("deduplicates paths", () => {
      const text = "See ~/clawd/TASKS.md and also ~/clawd/TASKS.md again.";
      const paths = extractMarkdownPaths(text);
      expect(paths).toEqual(["~/clawd/TASKS.md"]);
    });

    it("returns empty array when no paths", () => {
      expect(extractMarkdownPaths("no paths here")).toEqual([]);
    });
  });

  describe("getFilename", () => {
    it("extracts filename from path", () => {
      expect(getFilename("~/clawd/TASKS.md")).toBe("TASKS.md");
      expect(getFilename("docs/features/foo/01-prd.md")).toBe("01-prd.md");
      expect(getFilename("MEMORY.md")).toBe("MEMORY.md");
    });
  });

  describe("normalizePath", () => {
    it("strips ~/clawd/ prefix", () => {
      expect(normalizePath("~/clawd/TASKS.md")).toBe("TASKS.md");
      expect(normalizePath("~/clawd/docs/features/foo.md")).toBe("docs/features/foo.md");
    });

    it("strips OS prefixes", () => {
      expect(normalizePath("Mac:~/clawd/TASKS.md")).toBe("TASKS.md");
      expect(normalizePath("Win:~/clawd/docs/foo.md")).toBe("docs/foo.md");
    });

    it("handles absolute paths with clawd", () => {
      expect(normalizePath("/home/user/clawd/TASKS.md")).toBe("TASKS.md");
      expect(normalizePath("/foo/gordon-workspace/docs/bar.md")).toBe("docs/bar.md");
    });

    it("strips ./ prefix", () => {
      expect(normalizePath("./TASKS.md")).toBe("TASKS.md");
      expect(normalizePath("./docs/foo.md")).toBe("docs/foo.md");
    });

    it("leaves relative paths unchanged", () => {
      expect(normalizePath("docs/features/foo.md")).toBe("docs/features/foo.md");
      expect(normalizePath("MEMORY.md")).toBe("MEMORY.md");
    });
  });

  describe("transformPathsToLinks", () => {
    it("wraps paths in clickable spans", () => {
      const result = transformPathsToLinks("See ~/clawd/TASKS.md");
      expect(result).toContain('class="md-path-link"');
      expect(result).toContain('data-path="~/clawd/TASKS.md"');
    });

    it("handles multiple paths", () => {
      const result = transformPathsToLinks("A: docs/a.md and B: docs/b.md");
      expect(result).toContain('data-path="docs/a.md"');
      expect(result).toContain('data-path="docs/b.md"');
    });

    it("returns empty string for empty input", () => {
      expect(transformPathsToLinks("")).toBe("");
    });
  });
});
