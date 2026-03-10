import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { cropImageHalves, type BoardLayout } from "../gemini";

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

function layout(
  splitAxis: "x" | "y",
  splitPercent: number
): BoardLayout {
  return { boardColors: ["yellow", "blue", "white", "green", "red"], splitAxis, splitPercent };
}

describe("cropImageHalves", () => {
  describe("horizontal strip (splitAxis=y)", () => {
    it("splits at 50% into roughly equal halves", async () => {
      const img = await makeTestImage(800, 600);
      const { sideA, sideB } = await cropImageHalves(img, layout("y", 50));
      const a = await getDimensions(sideA);
      const b = await getDimensions(sideB);

      expect(a.width).toBe(800);
      expect(b.width).toBe(800);
      expect(a.height).toBeGreaterThan(250);
      expect(a.height).toBeLessThan(400);
      expect(b.height).toBeGreaterThan(250);
      expect(b.height).toBeLessThan(400);
    });

    it("handles off-center split at 30%", async () => {
      const img = await makeTestImage(800, 600);
      const { sideA, sideB } = await cropImageHalves(img, layout("y", 30));
      const a = await getDimensions(sideA);
      const b = await getDimensions(sideB);

      // Side A (top, 30%) should be smaller than Side B (bottom, 70%)
      expect(a.height).toBeLessThan(b.height);
      expect(b.height).toBeGreaterThan(350);
    });

    it("side A is always the top half", async () => {
      const img = await makeTestImage(400, 400);
      const { sideA, sideB } = await cropImageHalves(img, layout("y", 50));
      const a = await getDimensions(sideA);
      const b = await getDimensions(sideB);

      // Both should be roughly half, and their combined height
      // (minus overlap) should approximate the full image
      expect(a.height + b.height).toBeGreaterThan(400);
      expect(a.height).toBeGreaterThan(0);
      expect(b.height).toBeGreaterThan(0);
    });
  });

  describe("vertical strip (splitAxis=x)", () => {
    it("splits at 50% into roughly equal halves", async () => {
      const img = await makeTestImage(800, 600);
      const { sideA, sideB } = await cropImageHalves(img, layout("x", 50));
      const a = await getDimensions(sideA);
      const b = await getDimensions(sideB);

      expect(a.height).toBe(600);
      expect(b.height).toBe(600);
      expect(a.width).toBeGreaterThan(350);
      expect(a.width).toBeLessThan(500);
      expect(b.width).toBeGreaterThan(350);
      expect(b.width).toBeLessThan(500);
    });

    it("handles off-center split at 70%", async () => {
      const img = await makeTestImage(1000, 600);
      const { sideA, sideB } = await cropImageHalves(img, layout("x", 70));
      const a = await getDimensions(sideA);
      const b = await getDimensions(sideB);

      // Side A (left, 70%) should be wider than Side B (right, 30%)
      expect(a.width).toBeGreaterThan(b.width);
    });

    it("side A is always the left half", async () => {
      const img = await makeTestImage(400, 400);
      const { sideA, sideB } = await cropImageHalves(img, layout("x", 50));
      const a = await getDimensions(sideA);
      const b = await getDimensions(sideB);

      expect(a.width + b.width).toBeGreaterThan(400);
      expect(a.width).toBeGreaterThan(0);
      expect(b.width).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("clamps extreme splitPercent (5 → 15)", async () => {
      const img = await makeTestImage(400, 400);
      const { sideA, sideB } = await cropImageHalves(img, layout("y", 5));
      const a = await getDimensions(sideA);
      const b = await getDimensions(sideB);

      expect(a.height).toBeGreaterThan(50);
      expect(b.height).toBeGreaterThan(50);
    });

    it("clamps extreme splitPercent (95 → 85)", async () => {
      const img = await makeTestImage(400, 400);
      const { sideA, sideB } = await cropImageHalves(img, layout("y", 95));
      const a = await getDimensions(sideA);
      const b = await getDimensions(sideB);

      expect(a.height).toBeGreaterThan(50);
      expect(b.height).toBeGreaterThan(50);
    });

    it("produces valid JPEG output", async () => {
      const img = await makeTestImage(200, 200);
      const { sideA, sideB } = await cropImageHalves(img, layout("y", 50));

      const aMeta = await sharp(Buffer.from(sideA, "base64")).metadata();
      const bMeta = await sharp(Buffer.from(sideB, "base64")).metadata();
      expect(aMeta.format).toBe("jpeg");
      expect(bMeta.format).toBe("jpeg");
    });
  });
});
