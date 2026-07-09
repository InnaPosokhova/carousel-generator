import { toPng } from "html-to-image";
import JSZip from "jszip";
import type { AspectRatio } from "./aspect-ratios";

// Slides are rendered off-screen at this CSS width, then rasterized with
// pixelRatio = target / base so the PNG comes out at the true resolution
// (e.g. 1080 / 360 = 3x) with crisp text.
export const EXPORT_BASE_WIDTH = 360;

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "carousel"
  );
}

// Neutral stand-in when a background image can't be fetched at export time —
// the export succeeds with a plain background instead of failing outright.
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="100%" height="100%" fill="#e4e4e7"/></svg>',
  );

export async function renderSlidePng(
  element: HTMLElement,
  aspectRatio: AspectRatio,
): Promise<string> {
  // Web fonts must be fully loaded or html-to-image bakes the fallback
  // font into the PNG.
  await document.fonts.ready;
  return toPng(element, {
    pixelRatio: aspectRatio.width / EXPORT_BASE_WIDTH,
    imagePlaceholder: IMAGE_PLACEHOLDER,
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function downloadZip(
  files: { name: string; dataUrl: string }[],
  zipName: string,
): Promise<void> {
  const zip = new JSZip();
  for (const { name, dataUrl } of files) {
    zip.file(name, dataUrl.slice(dataUrl.indexOf(",") + 1), { base64: true });
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
