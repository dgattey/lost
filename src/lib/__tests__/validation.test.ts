import { describe, expect, it, vi } from "vitest";
import { analyzedGameSchema } from "../validation";
import { findConsistencyProblems } from "../gemini";

// Suppress console.log from the validation transform during tests
vi.spyOn(console, "log").mockImplementation(() => {});

function makeExp(
  color: string,
  totalCardsInColumn: number,
  wagerCount: number,
  cardValues: number[]
) {
  return { color, totalCardsInColumn, wagerCount, cardValues };
}

function makeRaw(
  p1: ReturnType<typeof makeExp>[],
  p2: ReturnType<typeof makeExp>[]
) {
  return {
    player1: { expeditions: p1 },
    player2: { expeditions: p2 },
  };
}

// ---------------------------------------------------------------------------
// analyzedGameSchema — wager correction
// ---------------------------------------------------------------------------

describe("analyzedGameSchema wager correction", () => {
  it("passes through correct data unchanged", () => {
    const raw = makeRaw(
      [makeExp("yellow", 7, 1, [2, 4, 5, 8, 9, 10])],
      [makeExp("red", 7, 3, [4, 5, 6, 7])]
    );
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0].wagerCount).toBe(1);
    expect(result.player1.expeditions[0].cardValues).toEqual([2, 4, 5, 8, 9, 10]);
    expect(result.player2.expeditions[0].wagerCount).toBe(3);
  });

  it("derives wagerCount from totalCardsInColumn when they disagree", () => {
    // totalCards=8, numbered=7 → wager should be 1, not 0
    const raw = makeRaw(
      [makeExp("white", 8, 0, [2, 5, 6, 7, 8, 9, 10])],
      []
    );
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0].wagerCount).toBe(1);
  });

  it("clamps wagerCount to max 3 when totalCards implies more", () => {
    // totalCards=10, numbered=5 → derived=5, but clamp to 3
    const raw = makeRaw(
      [makeExp("green", 10, 5, [2, 3, 7, 9, 10])],
      []
    );
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0].wagerCount).toBe(3);
  });

  it("clamps negative wagerCount to 0", () => {
    const raw = makeRaw([makeExp("blue", 3, -1, [2, 3, 5])], []);
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0].wagerCount).toBe(0);
  });

  it("handles wagerCount > 3 by clamping", () => {
    // Model returned wagerCount=5 for red (bug seen in the wild)
    const raw = makeRaw([makeExp("red", 9, 5, [4, 5, 6, 7])], []);
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0].wagerCount).toBe(3);
  });

  it("leaves wagerCount=0 when totalCards equals numbered cards", () => {
    const raw = makeRaw(
      [makeExp("yellow", 6, 0, [2, 4, 5, 8, 9, 10])],
      []
    );
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0].wagerCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// analyzedGameSchema — card value cleanup
// ---------------------------------------------------------------------------

describe("analyzedGameSchema card value cleanup", () => {
  it("deduplicates card values", () => {
    const raw = makeRaw(
      [makeExp("yellow", 5, 0, [3, 5, 5, 7, 10])],
      []
    );
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0].cardValues).toEqual([3, 5, 7, 10]);
  });

  it("sorts card values in ascending order", () => {
    const raw = makeRaw(
      [makeExp("blue", 4, 0, [10, 3, 7, 5])],
      []
    );
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0].cardValues).toEqual([3, 5, 7, 10]);
  });

  it("handles empty expeditions", () => {
    const raw = makeRaw([makeExp("green", 0, 0, [])], []);
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0]).toEqual({
      color: "green",
      wagerCount: 0,
      cardValues: [],
    });
  });

  it("handles wager-only expeditions (no numbered cards)", () => {
    const raw = makeRaw([makeExp("purple", 2, 2, [])], []);
    const result = analyzedGameSchema.parse(raw);
    expect(result.player1.expeditions[0].wagerCount).toBe(2);
    expect(result.player1.expeditions[0].cardValues).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// analyzedGameSchema — full game validation
// ---------------------------------------------------------------------------

describe("analyzedGameSchema full game", () => {
  it("validates a realistic full game correctly", () => {
    const raw = makeRaw(
      [
        makeExp("yellow", 7, 1, [2, 4, 5, 8, 9, 10]),
        makeExp("blue", 8, 1, [2, 3, 5, 6, 7, 8, 9]),
        makeExp("white", 0, 0, []),
        makeExp("green", 6, 1, [2, 3, 7, 9, 10]),
        makeExp("red", 0, 0, []),
        makeExp("purple", 0, 0, []),
      ],
      [
        makeExp("yellow", 0, 0, []),
        makeExp("blue", 0, 0, []),
        makeExp("white", 8, 1, [2, 5, 6, 7, 8, 9, 10]),
        makeExp("green", 0, 0, []),
        makeExp("red", 7, 3, [4, 5, 6, 7]),
        makeExp("purple", 6, 1, [3, 5, 7, 9, 10]),
      ]
    );
    const result = analyzedGameSchema.parse(raw);

    // Player 1
    const p1 = result.player1.expeditions;
    expect(p1.find((e) => e.color === "yellow")).toEqual({
      color: "yellow",
      wagerCount: 1,
      cardValues: [2, 4, 5, 8, 9, 10],
    });
    expect(p1.find((e) => e.color === "blue")).toEqual({
      color: "blue",
      wagerCount: 1,
      cardValues: [2, 3, 5, 6, 7, 8, 9],
    });
    expect(p1.find((e) => e.color === "green")).toEqual({
      color: "green",
      wagerCount: 1,
      cardValues: [2, 3, 7, 9, 10],
    });

    // Player 2
    const p2 = result.player2.expeditions;
    expect(p2.find((e) => e.color === "white")).toEqual({
      color: "white",
      wagerCount: 1,
      cardValues: [2, 5, 6, 7, 8, 9, 10],
    });
    expect(p2.find((e) => e.color === "red")).toEqual({
      color: "red",
      wagerCount: 3,
      cardValues: [4, 5, 6, 7],
    });
    expect(p2.find((e) => e.color === "purple")).toEqual({
      color: "purple",
      wagerCount: 1,
      cardValues: [3, 5, 7, 9, 10],
    });
  });

  it("rejects invalid expedition colors", () => {
    const raw = makeRaw(
      [makeExp("orange" as string, 3, 1, [4, 5])],
      []
    );
    expect(() => analyzedGameSchema.parse(raw)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// findConsistencyProblems
// ---------------------------------------------------------------------------

describe("findConsistencyProblems", () => {
  it("returns empty array for consistent data", () => {
    const exps = [
      makeExp("yellow", 7, 1, [2, 4, 5, 8, 9, 10]),
      makeExp("red", 7, 3, [4, 5, 6, 7]),
      makeExp("blue", 0, 0, []),
    ];
    expect(findConsistencyProblems(exps)).toEqual([]);
  });

  it("detects wagerCount out of range (> 3)", () => {
    const exps = [makeExp("red", 9, 5, [4, 5, 6, 7])];
    const problems = findConsistencyProblems(exps);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain("wagerCount=5");
    expect(problems[0]).toContain("out of range");
  });

  it("detects wagerCount out of range (< 0)", () => {
    const exps = [makeExp("blue", 3, -1, [2, 3, 5])];
    const problems = findConsistencyProblems(exps);
    expect(problems.some((p) => p.includes("out of range"))).toBe(true);
  });

  it("detects totalCards mismatch", () => {
    // total=10, but wager(1) + numbered(6) = 7
    const exps = [makeExp("yellow", 10, 1, [2, 4, 5, 8, 9, 10])];
    const problems = findConsistencyProblems(exps);
    expect(problems.some((p) => p.includes("totalCards=10"))).toBe(true);
  });

  it("detects duplicate card values", () => {
    const exps = [makeExp("green", 4, 0, [3, 5, 5, 7])];
    const problems = findConsistencyProblems(exps);
    expect(problems.some((p) => p.includes("duplicate"))).toBe(true);
  });

  it("detects card values out of range", () => {
    const exps = [makeExp("white", 3, 0, [1, 5, 11])];
    const problems = findConsistencyProblems(exps);
    expect(problems.some((p) => p.includes("card value 1"))).toBe(true);
    expect(problems.some((p) => p.includes("card value 11"))).toBe(true);
  });

  it("detects multiple problems at once", () => {
    const exps = [
      makeExp("red", 10, 5, [4, 5, 5, 6, 7]),
    ];
    const problems = findConsistencyProblems(exps);
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });

  it("handles empty expeditions with no problems", () => {
    const exps = [
      makeExp("yellow", 0, 0, []),
      makeExp("blue", 0, 0, []),
    ];
    expect(findConsistencyProblems(exps)).toEqual([]);
  });
});
