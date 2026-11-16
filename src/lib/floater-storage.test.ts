import { describe, expect, it } from "vitest";

import { detectProjectType, normalizeThreadTitle, readStoredList } from "./floater-storage";

describe("Floater workspace helpers", () => {
  it("detects HTML motion and canvas projects from their animation code", () => {
    expect(detectProjectType("<canvas id='scene'></canvas>")).toBe("motion");
    expect(detectProjectType("@keyframes float { from { opacity: 0 } }")).toBe("motion");
    expect(detectProjectType("<main><h1>Hello</h1></main>")).toBe("web");
  });

  it("returns an empty project list for corrupt local storage", () => {
    expect(readStoredList("not-json")).toEqual([]);
    expect(readStoredList("{}" )).toEqual([]);
  });

  it("keeps project titles compact and supplies a safe default", () => {
    expect(normalizeThreadTitle("  My   new studio  ")).toBe("My new studio");
    expect(normalizeThreadTitle(" ")).toBe("Untitled project");
    expect(normalizeThreadTitle("a".repeat(100))).toHaveLength(72);
  });
});