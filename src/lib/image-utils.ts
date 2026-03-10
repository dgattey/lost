/**
 * Resize an image file client-side to keep it under size limits for the AI API.
 * Returns a base64-encoded JPEG string (without the data URI prefix).
 */
export async function resizeImage(
  file: File,
  maxDimension = 2560
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Crop an image (as base64) into two halves at a split point.
 * Runs client-side using the browser Canvas API — no server dependencies.
 *
 * Returns { sideA, sideB } where sideA is top/left and sideB is bottom/right.
 */
export async function cropImageHalves(
  imageBase64: string,
  splitAxis: "x" | "y",
  splitPercent: number
): Promise<{ sideA: string; sideB: string }> {
  const img = await loadImage(`data:image/jpeg;base64,${imageBase64}`);
  const { width, height } = img;

  const pct = Math.max(15, Math.min(85, splitPercent));
  const distFromCenter = Math.abs(pct - 50);
  const overlapPct = Math.max(3, 8 - distFromCenter * 0.1);

  function cropToBase64(
    sx: number,
    sy: number,
    sw: number,
    sh: number
  ): string {
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
  }

  if (splitAxis === "y") {
    const splitY = Math.round((height * pct) / 100);
    const overlapPx = Math.round((height * overlapPct) / 100);

    const aH = Math.min(height, splitY + overlapPx);
    const bTop = Math.max(0, splitY - overlapPx);

    return {
      sideA: cropToBase64(0, 0, width, aH),
      sideB: cropToBase64(0, bTop, width, height - bTop),
    };
  } else {
    const splitX = Math.round((width * pct) / 100);
    const overlapPx = Math.round((width * overlapPct) / 100);

    const aW = Math.min(width, splitX + overlapPx);
    const bLeft = Math.max(0, splitX - overlapPx);

    return {
      sideA: cropToBase64(0, 0, aW, height),
      sideB: cropToBase64(bLeft, 0, width - bLeft, height),
    };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = src;
  });
}
