import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { cropImageHalves } from "../gemini";

/** Create a solid-color test image as base64 JPEG */
async function makeTestImage(
  width: number,
  height: number
): Promise<string> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  return buf.toString("base64");
}

async function getDimensions(base64: string) {
  const buf = Buffer.from(base64, "base64");
  const meta = await sharp(buf).metadata();
  return { width: meta.width!, height: meta.height! };
}

describe("cropImageHalves", () => {
  describe("horizontal strip (splitAxis=y)", () => {
    it("splits at 50% into roughly equal halves", async () => {
      const img = await makeTestImage(800, 600);
      const layout = {
        boardColors: ["yellow", "blue", "white", "green", "red"],
        orientation: "horizontal" as const,
        splitAxis: "y" as const,
        splitPercent: 50,
        player1Side: "bottom" as const,
      };

      const { player1Half, player2Half } = await cropImageHalves(img, layout);
      const p1 = await getDimensions(player1Half);
      const p2 = await getDimensions(player2Half);

      // Both halves span the full width
      expect(p1.width).toBe(800);
      expect(p2.width).toBe(800);

      // Each half is roughly half the height (with overlap)
      expect(p1.height).toBeGreaterThan(250);
      expect(p1.height).toBeLessThan(400);
      expect(p2.height).toBeGreaterThan(250);
      expect(p2.height).toBeLessThan(400);
    });

    it("handles off-center split at 30%", async () => {
      const img = await makeTestImage(800, 600);
      const layout = {
        boardColors: ["yellow", "blue", "white", "green", "red"],
        orientation: "horizontal" as const,
        splitAxis: "y" as const,
        splitPercent: 30,
        player1Side: "bottom" as const,
      };

      const { player1Half, player2Half } = await cropImageHalves(img, layout);
      const p1 = await getDimensions(player1Half);
      const p2 = await getDimensions(player2Half);

      // P2 (top half at 30%) should be smaller than P1 (bottom 70%)
      expect(p2.height).toBeLessThan(p1.height);
      // P1 (bottom) gets the bigger portion
      expect(p1.height).toBeGreaterThan(350);
    });

    it("respects player1Side=top", async () => {
      const img = await makeTestImage(400, 400);
      const layoutBottom = {
        boardColors: ["yellow"],
        orientation: "horizontal" as const,
        splitAxis: "y" as const,
        splitPercent: 50,
        player1Side: "bottom" as const,
      };
      const layoutTop = {
        ...layoutBottom,
        player1Side: "top" as const,
      };

      const resultBottom = await cropImageHalves(img, layoutBottom);
      const resultTop = await cropImageHalves(img, layoutTop);

      const p1TopDim = await getDimensions(resultTop.player1Half);
      const p2BottomDim = await getDimensions(resultBottom.player2Half);

      // When P1 side flips, P1's half should match what was P2's half
      expect(p1TopDim.height).toBe(p2BottomDim.height);
    });
  });

  describe("vertical strip (splitAxis=x)", () => {
    it("splits at 50% into roughly equal halves", async () => {
      const img = await makeTestImage(800, 600);
      const layout = {
        boardColors: ["yellow", "blue", "white", "green", "red"],
        orientation: "vertical" as const,
        splitAxis: "x" as const,
        splitPercent: 50,
        player1Side: "right" as const,
      };

      const { player1Half, player2Half } = await cropImageHalves(img, layout);
      const p1 = await getDimensions(player1Half);
      const p2 = await getDimensions(player2Half);

      // Both halves span the full height
      expect(p1.height).toBe(600);
      expect(p2.height).toBe(600);

      // Each half is roughly half the width (with overlap)
      expect(p1.width).toBeGreaterThan(350);
      expect(p1.width).toBeLessThan(500);
      expect(p2.width).toBeGreaterThan(350);
      expect(p2.width).toBeLessThan(500);
    });

    it("handles off-center split at 70%", async () => {
      const img = await makeTestImage(1000, 600);
      const layout = {
        boardColors: ["yellow", "blue", "white", "green", "red"],
        orientation: "vertical" as const,
        splitAxis: "x" as const,
        splitPercent: 70,
        player1Side: "right" as const,
      };

      const { player1Half, player2Half } = await cropImageHalves(img, layout);
      const p1 = await getDimensions(player1Half);
      const p2 = await getDimensions(player2Half);

      // P2 (left, 70%) should be wider than P1 (right, 30%)
      expect(p2.width).toBeGreaterThan(p1.width);
    });

    it("respects player1Side=left", async () => {
      const img = await makeTestImage(400, 400);
      const layoutRight = {
        boardColors: ["yellow"],
        orientation: "vertical" as const,
        splitAxis: "x" as const,
        splitPercent: 50,
        player1Side: "right" as const,
      };
      const layoutLeft = {
        ...layoutRight,
        player1Side: "left" as const,
      };

      const resultRight = await cropImageHalves(img, layoutRight);
      const resultLeft = await cropImageHalves(img, layoutLeft);

      const p1LeftDim = await getDimensions(resultLeft.player1Half);
      const p2RightDim = await getDimensions(resultRight.player2Half);

      // When P1 side flips, P1's half should match what was P2's half
      expect(p1LeftDim.width).toBe(p2RightDim.width);
    });
  });

  describe("edge cases", () => {
    it("clamps extreme splitPercent values", async () => {
      const img = await makeTestImage(400, 400);

      // splitPercent=5 should be clamped to 15
      const layout = {
        boardColors: ["yellow"],
        orientation: "horizontal" as const,
        splitAxis: "y" as const,
        splitPercent: 5,
        player1Side: "bottom" as const,
      };

      const { player1Half, player2Half } = await cropImageHalves(img, layout);
      const p1 = await getDimensions(player1Half);
      const p2 = await getDimensions(player2Half);

      // Neither half should be extremely tiny
      expect(p1.height).toBeGreaterThan(50);
      expect(p2.height).toBeGreaterThan(50);
    });

    it("clamps splitPercent=95 to 85", async () => {
      const img = await makeTestImage(400, 400);
      const layout = {
        boardColors: ["yellow"],
        orientation: "horizontal" as const,
        splitAxis: "y" as const,
        splitPercent: 95,
        player1Side: "bottom" as const,
      };

      const { player1Half, player2Half } = await cropImageHalves(img, layout);
      const p1 = await getDimensions(player1Half);
      const p2 = await getDimensions(player2Half);

      expect(p1.height).toBeGreaterThan(50);
      expect(p2.height).toBeGreaterThan(50);
    });

    it("handles diagonal orientation with splitAxis=y", async () => {
      const img = await makeTestImage(800, 600);
      const layout = {
        boardColors: ["yellow", "blue"],
        orientation: "diagonal" as const,
        splitAxis: "y" as const,
        splitPercent: 45,
        player1Side: "bottom" as const,
      };

      const { player1Half, player2Half } = await cropImageHalves(img, layout);
      const p1 = await getDimensions(player1Half);
      const p2 = await getDimensions(player2Half);

      expect(p1.width).toBe(800);
      expect(p2.width).toBe(800);
      expect(p1.height).toBeGreaterThan(0);
      expect(p2.height).toBeGreaterThan(0);
    });

    it("produces valid JPEG output", async () => {
      const img = await makeTestImage(200, 200);
      const layout = {
        boardColors: ["yellow"],
        orientation: "horizontal" as const,
        splitAxis: "y" as const,
        splitPercent: 50,
        player1Side: "bottom" as const,
      };

      const { player1Half, player2Half } = await cropImageHalves(img, layout);

      // Should be valid base64 that sharp can read
      const p1Meta = await sharp(Buffer.from(player1Half, "base64")).metadata();
      const p2Meta = await sharp(Buffer.from(player2Half, "base64")).metadata();
      expect(p1Meta.format).toBe("jpeg");
      expect(p2Meta.format).toBe("jpeg");
    });
  });
});
