import { describe, expect, it } from "vitest";
import { scoreExpedition, scoreGame, scorePlayer } from "../scoring";
import type { ExpeditionData, PlayerData } from "../types";

function makeExpedition(
  wagerCount: number,
  cardValues: number[],
  color: ExpeditionData["color"] = "yellow"
): ExpeditionData {
  return { color, wagerCount, cardValues };
}

describe("scoreExpedition", () => {
  it("returns 0 for an empty expedition (no cards, no wagers)", () => {
    const result = scoreExpedition(makeExpedition(0, []));
    expect(result.score).toBe(0);
    expect(result.breakdown).toBe("No cards played");
  });

  it("scores a single low card as negative", () => {
    // (5 - 20) × 1 = -15
    const result = scoreExpedition(makeExpedition(0, [5]));
    expect(result.score).toBe(-15);
  });

  it("scores multiple cards with no wager", () => {
    // (3 + 5 + 7 + 10 - 20) × 1 = 5
    const result = scoreExpedition(makeExpedition(0, [3, 5, 7, 10]));
    expect(result.score).toBe(5);
  });

  it("scores cards summing to exactly 20 as 0", () => {
    // (2 + 3 + 5 + 10 - 20) × 1 = 0
    const result = scoreExpedition(makeExpedition(0, [2, 3, 5, 10]));
    expect(result.score).toBe(0);
  });

  it("applies 1 wager (×2 multiplier)", () => {
    // (6 + 8 - 20) × 2 = -12
    const result = scoreExpedition(makeExpedition(1, [6, 8]));
    expect(result.score).toBe(-12);
  });

  it("applies 2 wagers (×3 multiplier)", () => {
    // (5 + 7 + 9 - 20) × 3 = 3
    const result = scoreExpedition(makeExpedition(2, [5, 7, 9]));
    expect(result.score).toBe(3);
  });

  it("applies 3 wagers (×4 multiplier)", () => {
    // 3 wagers + 3 numbered = 6 cards (no bonus)
    // (4 + 6 + 8 - 20) × 4 = -8
    const result = scoreExpedition(makeExpedition(3, [4, 6, 8]));
    expect(result.score).toBe(-8);
  });

  it("scores all wagers with no numbered cards as very negative", () => {
    // (0 - 20) × 4 = -80, only 3 cards so no bonus
    const result = scoreExpedition(makeExpedition(3, []));
    expect(result.score).toBe(-80);
  });

  it("awards 20-point bonus for 8+ cards (no wagers)", () => {
    // Cards: 2,3,4,5,6,7,8,9 = 8 cards, sum = 44
    // (44 - 20) × 1 = 24, +20 bonus = 44
    const result = scoreExpedition(makeExpedition(0, [2, 3, 4, 5, 6, 7, 8, 9]));
    expect(result.score).toBe(44);
  });

  it("awards 20-point bonus for 8+ cards (with wagers)", () => {
    // 3 wagers + 5 numbered = 8 total cards
    // Cards: 2,3,5,7,10 sum = 27
    // (27 - 20) × 4 = 28, + 20 bonus = 48
    const result = scoreExpedition(makeExpedition(3, [2, 3, 5, 7, 10]));
    expect(result.score).toBe(48);
  });

  it("awards bonus for 9+ cards (well over threshold)", () => {
    // 3 wagers + 9 numbered (2-10) = 12 total cards
    // sum = 2+3+4+5+6+7+8+9+10 = 54
    // (54 - 20) × 4 = 136, + 20 bonus = 156
    const result = scoreExpedition(
      makeExpedition(3, [2, 3, 4, 5, 6, 7, 8, 9, 10])
    );
    expect(result.score).toBe(156);
  });

  it("does NOT award bonus for exactly 7 cards", () => {
    // 1 wager + 6 numbered = 7 cards
    // Cards: 4,5,6,7,8,9 sum = 39
    // (39 - 20) × 2 = 38, no bonus
    const result = scoreExpedition(makeExpedition(1, [4, 5, 6, 7, 8, 9]));
    expect(result.score).toBe(38);
  });

  it("handles negative score with wagers (wagers amplify losses)", () => {
    // 2 wagers + 1 card (value 2) = 3 total
    // (2 - 20) × 3 = -54
    const result = scoreExpedition(makeExpedition(2, [2]));
    expect(result.score).toBe(-54);
  });

  it("provides a meaningful breakdown string", () => {
    const result = scoreExpedition(makeExpedition(1, [3, 7]));
    // (3 + 7 − 20) × 2 = -20
    expect(result.score).toBe(-20);
    expect(result.breakdown).toContain("3 + 7");
    expect(result.breakdown).toContain("× 2");
    expect(result.breakdown).toContain("-20");
  });

  it("includes bonus in breakdown for 8+ cards", () => {
    const result = scoreExpedition(
      makeExpedition(0, [2, 3, 4, 5, 6, 7, 8, 9])
    );
    expect(result.breakdown).toContain("bonus");
    expect(result.breakdown).toContain("44");
  });
});

describe("scorePlayer", () => {
  it("sums scores across multiple expeditions", () => {
    const player: PlayerData = {
      name: "Alice",
      expeditions: [
        makeExpedition(0, [5, 8, 10], "yellow"), // (23-20)=3
        makeExpedition(0, [], "blue"), // 0
        makeExpedition(1, [3, 6, 9], "green"), // (18-20)×2 = -4
      ],
    };
    const result = scorePlayer(player);
    expect(result.name).toBe("Alice");
    expect(result.totalScore).toBe(3 + 0 + -4);
    expect(result.totalScore).toBe(-1);
  });

  it("handles all empty expeditions", () => {
    const player: PlayerData = {
      name: "Bob",
      expeditions: [
        makeExpedition(0, [], "yellow"),
        makeExpedition(0, [], "blue"),
        makeExpedition(0, [], "green"),
      ],
    };
    const result = scorePlayer(player);
    expect(result.totalScore).toBe(0);
  });
});

describe("scoreGame", () => {
  it("determines the winner correctly", () => {
    const p1: PlayerData = {
      name: "Alice",
      expeditions: [makeExpedition(0, [5, 8, 10], "yellow")], // 3
    };
    const p2: PlayerData = {
      name: "Bob",
      expeditions: [makeExpedition(0, [2, 3], "yellow")], // (5-20) = -15
    };
    const result = scoreGame(p1, p2);
    expect(result.winner).toBe("Alice");
    expect(result.player1.totalScore).toBe(3);
    expect(result.player2.totalScore).toBe(-15);
  });

  it("returns null winner for a tie", () => {
    const p1: PlayerData = {
      name: "Alice",
      expeditions: [makeExpedition(0, [10, 10], "yellow")],
    };
    const p2: PlayerData = {
      name: "Bob",
      expeditions: [makeExpedition(0, [10, 10], "blue")],
    };
    const result = scoreGame(p1, p2);
    expect(result.winner).toBeNull();
  });

  it("handles a realistic full game", () => {
    const p1: PlayerData = {
      name: "Alice",
      expeditions: [
        makeExpedition(1, [3, 5, 7, 8, 10], "yellow"),
        // (33-20)×2 = 26
        makeExpedition(0, [], "blue"),
        // 0
        makeExpedition(0, [2, 4, 6], "white"),
        // (12-20) = -8
        makeExpedition(2, [6, 7, 8, 9, 10], "green"),
        // (40-20)×3 = 60
        makeExpedition(0, [], "red"),
        // 0
      ],
    };
    // Total: 26 + 0 + (-8) + 60 + 0 = 78

    const p2: PlayerData = {
      name: "Bob",
      expeditions: [
        makeExpedition(0, [4, 9], "yellow"),
        // (13-20) = -7
        makeExpedition(3, [2, 3, 4, 5, 6], "blue"),
        // (20-20)×4 = 0, 8 cards → +20 = 20
        makeExpedition(0, [], "white"),
        // 0
        makeExpedition(0, [8, 9, 10], "green"),
        // (27-20) = 7
        makeExpedition(1, [5, 6, 7, 8, 9, 10], "red"),
        // (45-20)×2 = 50
      ],
    };
    // Total: -7 + 20 + 0 + 7 + 50 = 70

    const result = scoreGame(p1, p2);
    expect(result.player1.totalScore).toBe(78);
    expect(result.player2.totalScore).toBe(70);
    expect(result.winner).toBe("Alice");
  });
});
