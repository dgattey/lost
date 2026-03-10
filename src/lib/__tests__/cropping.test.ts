import { describe, expect, it } from "vitest";
import { Jimp } from "jimp";
import { cropImageHalves, type BoardLayout } from "../gemini";

async function makeTestImage(
  width: number,
  height: number
): Promise<string> {
  const img = new Jimp({ width, height, color: 0x808080ff });
  const buf = await img.getBuffer("image/jpeg", { quality: 90 });
  return Buffer.from(buf).toString("base64");
}

async function getDimensions(base64: string) {
  const buf = Buffer.from(base64, "base64");
  const img = await Jimp.read(buf);
  return { width: img.width, height: img.height };
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

      expect(a.height).toBeLessThan(b.height);
      expect(b.height).toBeGreaterThan(350);
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

      expect(a.width).toBeGreaterThan(b.width);
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

      const aImg = await Jimp.read(Buffer.from(sideA, "base64"));
      const bImg = await Jimp.read(Buffer.from(sideB, "base64"));
      expect(aImg.width).toBeGreaterThan(0);
      expect(bImg.width).toBeGreaterThan(0);
    });
  });
});
